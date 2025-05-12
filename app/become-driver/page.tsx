"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useSupabase } from "@/providers/SupabaseProvider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Car, CheckCircle2, DollarSign, ShieldCheck, Upload, Check, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { trackSubmissionEvent } from "@/lib/analytics"
import { uploadDocument, isMockUrl, isValidDocumentUrl } from "./upload-utils"
import { uploadVehicleImages } from "./vehicle-image-upload"

const requirements = [
  {
    icon: <Car className="w-6 h-6 text-primary" />,
    title: "Required Vehicle Documents",
    items: [
      "Vehicle Registration Card",
      "Insurance Certificate",
      "Road Tax Certificate",
      "Technical Inspection Certificate"
    ]
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-primary" />,
    title: "Required Driver Documents",
    items: [
      "National ID Card (CNI)",
      "Driver's License"
    ]
  },
  {
    icon: <DollarSign className="w-6 h-6 text-primary" />,
    title: "Benefits",
    items: [
      "Earn more with long-distance rides",
      "Weekly payments",
      "Flexible schedule",
      "24/7 Support"
    ]
  }
]

const formSchema = z.object({
  // Document numbers
  nationalIdNumber: z.string().min(1, "National ID number is required"),
  licenseNumber: z.string().min(1, "License number is required"),
  registrationNumber: z.string().min(1, "Registration number is required"),
  insuranceNumber: z.string().min(1, "Insurance number is required"),
  technicalInspectionNumber: z.string().min(1, "Technical inspection number is required"),
  
  // Document files - using optional() to allow empty string during form initialization,
  // but we'll validate these separately before form submission
  nationalIdFile: z.string().optional(),
  licenseFile: z.string().optional(),
  registrationFile: z.string().optional(),
  insuranceFile: z.string().optional(),
  technicalInspectionFile: z.string().optional(),
  
  // Vehicle images (optional additional photos)
  vehicleImages: z.array(z.string()).optional(),
})

export default function BecomeDriverPage() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [vehicleImagesLoading, setVehicleImagesLoading] = useState(false)
  const [vehicleImages, setVehicleImages] = useState<string[]>([])
  
  // Document file upload states
  const [nationalIdFile, setNationalIdFile] = useState<string>("") 
  const [licenseFile, setLicenseFile] = useState<string>("") 
  const [registrationFile, setRegistrationFile] = useState<string>("") 
  const [insuranceFile, setInsuranceFile] = useState<string>("") 
  const [technicalInspectionFile, setTechnicalInspectionFile] = useState<string>("") 
  
  // Loading states for each document
  const [uploadingNationalId, setUploadingNationalId] = useState(false)
  const [uploadingLicense, setUploadingLicense] = useState(false)
  const [uploadingRegistration, setUploadingRegistration] = useState(false)
  const [uploadingInsurance, setUploadingInsurance] = useState(false)
  const [uploadingTechnicalInspection, setUploadingTechnicalInspection] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nationalIdNumber: "",
      licenseNumber: "",
      registrationNumber: "",
      insuranceNumber: "",
      technicalInspectionNumber: "",
      nationalIdFile: "",
      licenseFile: "",
      registrationFile: "",
      insuranceFile: "",
      technicalInspectionFile: "",
      vehicleImages: [],
    },
  })

  // Professional production-ready document upload function using our utility module
  // Define valid form field names for document uploads
  type DocumentFieldName = "nationalIdFile" | "licenseFile" | "registrationFile" | "insuranceFile" | "technicalInspectionFile";
  
  const handleDocumentUpload = async (
    file: File, 
    setLoading: (loading: boolean) => void, 
    setFileUrl: (url: string) => void, 
    formFieldName: DocumentFieldName
  ) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload documents.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Timestamp to force state updates as per company patterns
      const uploadStartTime = Date.now();
      
      // Validate file type
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const allowedTypes = ['jpg', 'jpeg', 'png', 'pdf'];
      
      if (!fileExt || !allowedTypes.includes(fileExt)) {
        toast({
          title: "Invalid File Type",
          description: `Please upload ${allowedTypes.join(", ")} files only.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Maximum file size is 10MB.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log(`💾 Uploading ${formFieldName} using resilient upload utilities`);
      
      // Use our utility function for more reliable uploads with better fallbacks
      const uploadResult = await uploadDocument(supabase, {
        file,
        userId: user.id,
        bucketName: 'driver_documents',
        docType: formFieldName
      });
      
      if (uploadResult.success) {
        // Upload successful (either real or mock)
        const { url, isMock } = uploadResult;
        
        // Log success with timestamp and mock status
        const uploadTime = Date.now() - uploadStartTime;
        console.log(`✅ Uploaded ${formFieldName} ${isMock ? '(mock)' : ''} in ${uploadTime}ms: ${url}`);
        
        if (isMock) {
          toast({
            title: "Document Processed",
            description: "Using development mode for document storage.",
            variant: "default",
          });
        } else {
          toast({
            title: "Document Uploaded",
            description: "Your document has been uploaded successfully.",
          });
        }
        
        // Since setFileUrl expects a direct string value and not a callback function,
        // we simply pass the url directly
        setFileUrl(url);
        
        // Update form field
        form.clearErrors(formFieldName);
        form.setValue(formFieldName, url, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true
        });
        
        // Register the field with the new value
        form.register(formFieldName, { value: url });
        
        // Force validation
        setTimeout(() => form.trigger(formFieldName), 200);
      } else {
        // Upload failed despite all fallbacks
        throw new Error(uploadResult.error || 'Unknown upload error');
      }
    } catch (error) {
      console.error("❌ Document upload failed:", error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your document. Please try again or contact support if the issue persists.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Removed bucket creation function as it's now handled by the upload utility

  // Individual document upload handlers
  const handleNationalIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    await handleDocumentUpload(
      e.target.files[0],
      setUploadingNationalId,
      setNationalIdFile,
      "nationalIdFile"
    )
  }

  const handleLicenseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    await handleDocumentUpload(
      e.target.files[0],
      setUploadingLicense,
      setLicenseFile,
      "licenseFile"
    )
  }

  const handleRegistrationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    await handleDocumentUpload(
      e.target.files[0],
      setUploadingRegistration,
      setRegistrationFile,
      "registrationFile"
    )
  }

  const handleInsuranceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    await handleDocumentUpload(
      e.target.files[0],
      setUploadingInsurance,
      setInsuranceFile,
      "insuranceFile"
    )
  }

  const handleTechnicalInspectionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    await handleDocumentUpload(
      e.target.files[0],
      setUploadingTechnicalInspection,
      setTechnicalInspectionFile,
      "technicalInspectionFile"
    )
  }

  // Handle vehicle images upload using our specialized utility
  const handleVehicleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    if (!user) return

    setVehicleImagesLoading(true)

    try {
      const filesToUpload: File[] = []
      
      // Filter files based on validation rules
      for (const file of Array.from(e.target.files)) {
        // File validations
        const fileExt = file.name.split(".").pop()?.toLowerCase()
        const fileSize = file.size / 1024 / 1024 // Size in MB

        // Validate file type and size
        if (!fileExt || !["jpg", "jpeg", "png"].includes(fileExt)) {
          toast({
            title: "Invalid file type",
            description: "Please upload JPG or PNG images only.",
            variant: "destructive",
          })
          continue
        }

        if (fileSize > 5) {
          toast({
            title: "File too large",
            description: "Please upload images smaller than 5MB.",
            variant: "destructive",
          })
          continue
        }
        
        // File passed validation, add to upload list
        filesToUpload.push(file)
      }
      
      if (filesToUpload.length === 0) {
        toast({
          title: "No Valid Images",
          description: "None of the selected files met the upload requirements.",
          variant: "destructive",
        })
        return
      }
      
      // Use our specialized upload utility to handle all uploads in parallel
      console.log(`💾 Uploading ${filesToUpload.length} vehicle images...`)
      const uploadResult = await uploadVehicleImages(supabase, filesToUpload, user.id)
      
      if (uploadResult.success) {
        const newVehicleImages = [...vehicleImages, ...uploadResult.urls]
        setVehicleImages(newVehicleImages)
        
        // Update form field value for submission
        form.setValue("vehicleImages", newVehicleImages, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true
        })
        
        toast({
          title: "Images Uploaded",
          description: `${uploadResult.urls.length} image(s) uploaded successfully.`,
        })
      } else if (uploadResult.urls.length > 0) {
        // Partial success
        const newVehicleImages = [...vehicleImages, ...uploadResult.urls]
        setVehicleImages(newVehicleImages)
        
        // Update form field value with partial success
        form.setValue("vehicleImages", newVehicleImages, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true
        })
        
        toast({
          title: "Partial Upload Success",
          description: `${uploadResult.urls.length} images uploaded, but ${uploadResult.errors.length} failed.`,
          variant: "default",
        })
      } else {
        // Complete failure
        toast({
          title: "Upload Failed",
          description: "Failed to upload vehicle images. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error uploading vehicle images:", error)
      toast({
        title: "Upload Error",
        description: "There was an error uploading your images.",
        variant: "destructive",
      })
    } finally {
      setVehicleImagesLoading(false)
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("📝 FORM SUBMISSION START 📝")
    console.log("Form submitted with values:", values)
    
    // Debug logging to help troubleshoot form submission issues
    console.log("🔍 National ID File:", nationalIdFile)
    console.log("🔍 License File:", licenseFile)
    console.log("🔍 Registration File:", registrationFile)
    console.log("🔍 Insurance File:", insuranceFile)
    console.log("🔍 Technical Inspection File:", technicalInspectionFile)
    console.log("🔍 Vehicle Images:", vehicleImages)
    
    // Pre-flight validation to ensure we have all required files
    const missingDocuments = [];
    
    // Comprehensive validation check for document files
    // Checks both existence and non-empty strings
    if (!nationalIdFile || nationalIdFile.trim() === "") missingDocuments.push("National ID");
    if (!licenseFile || licenseFile.trim() === "") missingDocuments.push("Driver's License");
    if (!registrationFile || registrationFile.trim() === "") missingDocuments.push("Vehicle Registration");
    if (!insuranceFile || insuranceFile.trim() === "") missingDocuments.push("Insurance");
    if (!technicalInspectionFile || technicalInspectionFile.trim() === "") missingDocuments.push("Technical Inspection");
    
    if (missingDocuments.length > 0) {
      console.error("❌ Missing required documents:", missingDocuments);
      toast({
        title: "Missing Documents",
        description: `Please upload the following required documents: ${missingDocuments.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validate all document file URLs (can be Supabase or mock URLs in dev mode)
    const documentFiles = [
      nationalIdFile,
      licenseFile,
      registrationFile,
      insuranceFile,
      technicalInspectionFile
    ];
    
    const invalidFiles = documentFiles.filter(url => !isValidDocumentUrl(url));
    
    if (invalidFiles.length > 0) {
      console.error("❌ Invalid document file URLs detected.");
      toast({
        title: "Upload Error",
        description: "Some documents appear to be invalid. Please try uploading them again.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if we're using mock URLs in development mode
    const usingMockUrls = documentFiles.some(url => isMockUrl(url));
    if (usingMockUrls) {
      console.warn("⚠️ Using mock URLs for some document files (development mode)");
      // We'll allow mock URLs to proceed in development
    }
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to submit your application.",
        variant: "destructive",
      })
      router.push("/auth")
      return
    }
    
    // Additional vehicle image validation could go here if needed
    if (vehicleImages.length === 0) {
      console.warn("⚠️ No vehicle images provided - this is optional but recommended");
    }
    
    // Force update form values with the latest state values right before submission
    // This ensures what we submit to the database is accurate and up-to-date
    form.setValue("nationalIdFile", nationalIdFile)
    form.setValue("licenseFile", licenseFile)
    form.setValue("registrationFile", registrationFile)
    form.setValue("insuranceFile", insuranceFile)
    form.setValue("technicalInspectionFile", technicalInspectionFile)

    try {
      setIsSubmitting(true)

      // First, check if user is already a driver
      console.log("🔍 CHECKING IF USER IS ALREADY A DRIVER:", user.id);
      const { data: profile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("is_driver, driver_status")
        .eq("id", user.id)
        .single()

      console.log("👤 User profile check result:", profile);
        
      if (profileCheckError) {
        console.error("❌ Error checking profile:", profileCheckError)
        throw profileCheckError
      }

      // FIXED LOGIC: Only consider them a driver if is_driver is true AND driver_status is not null/pending
      // This allows users with failed submissions to try again
      if (profile?.is_driver === true && profile?.driver_status !== null && profile?.driver_status !== "pending") {
        console.log("⚠️ USER IS ALREADY A DRIVER - Redirecting to dashboard");
        toast({
          title: "Already a Driver",
          description: "You are already registered as a driver.",
          variant: "destructive",
        })
        router.push("/driver/dashboard")
        return
      }
      
      console.log("✅ User can proceed with driver application")

      // Update profile to mark as driver
      console.log("🔄 Updating profile to mark as driver")
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          is_driver: true,
          driver_status: "pending",
        })
        .eq("id", user.id)

      if (profileError) {
        console.error("❌ Error updating profile:", profileError)
        throw profileError
      }
      console.log("✅ Profile updated successfully")

      // Using a transaction-like approach for data integrity
      // First make sure all uploads are complete
      console.log("🔍 Verifying all document uploads before submission");
      
      // ISO format timestamp for PostgreSQL compatibility
      const submissionIsoTimestamp = new Date().toISOString();
      // Numeric timestamp for duration calculations
      const submissionTimestamp = Date.now();
      
      // Construct submission data with validated document URLs
      const documentData = {
        driver_id: user.id,
        // Document numbers with proper validation and sanitization
        national_id_number: values.nationalIdNumber.trim(),
        license_number: values.licenseNumber.trim(),
        registration_number: values.registrationNumber.trim(),
        insurance_number: values.insuranceNumber.trim(),
        technical_inspection_number: values.technicalInspectionNumber.trim(),
        // Document files stored as fully validated URLs
        national_id_file: nationalIdFile,
        license_file: licenseFile,
        registration_file: registrationFile,
        insurance_file: insuranceFile,
        technical_inspection_file: technicalInspectionFile,
        // Additional vehicle images
        vehicle_images: vehicleImages,
        // Add timestamps for tracking (following company pattern)
        created_at: new Date().toISOString(),
        submission_timestamp: submissionIsoTimestamp // This is an ISO string that PostgreSQL can understand
      };
      
      console.log("💾 CRITICAL OPERATION: Inserting driver documents into database");
      console.log("Database payload:", JSON.stringify(documentData, null, 2));
      
      try {
        console.log("📝 Inserting driver documents for user ID:", user.id);
        
        const { data, error } = await supabase
          .from('driver_documents')
          .insert([
            {
              driver_id: user.id,
              national_id_number: values.nationalIdNumber,
              license_number: values.licenseNumber,
              registration_number: values.registrationNumber,
              insurance_number: values.insuranceNumber,
              technical_inspection_number: values.technicalInspectionNumber,
              national_id_file: nationalIdFile,
              license_file: licenseFile,
              registration_file: registrationFile,
              insurance_file: insuranceFile,
              technical_inspection_file: technicalInspectionFile,
              vehicle_images: vehicleImages,
              status: 'pending',
            }
          ])
        
        if (error) {
          console.error("❌ DATABASE ERROR in driver_documents insert:", error)
          throw error;
        }
        
        // Now update the profile to mark user as a driver (defensive approach)
        // Note: This is redundant with our new trigger but ensures data consistency
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_driver: true,
            driver_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
          
        if (profileError) {
          console.error("⚠️ WARNING: Profile update failed, but documents were saved:", profileError);
          // We continue since the trigger should handle this, but log the warning
        } else {
          console.log("✅ Profile successfully updated - user marked as driver with pending status");
        }
        
        console.log("✅ DATABASE SUCCESS: Driver documents inserted with ID:", data?.[0]?.id || 'unknown')
      } catch (insertError) {
        console.error("❌ CRITICAL DATABASE ERROR in driver_documents insert:", insertError)
        throw insertError;
      }

      // Following timestamp state pattern from company guidelines
      const completionTimestamp = Date.now();
      const processingTime = completionTimestamp - submissionTimestamp;
      
      console.log(`🎉 Application submission successful! (Processed in ${processingTime}ms)`);
      console.log("⏩ APPLICATION WORKFLOW COMPLETE - DATABASE RECORDS CREATED");
      
      // Track successful submission
      trackSubmissionEvent({
        userId: user.id,
        documentCount: 5 + vehicleImages.length,
        processingTime
      });
      
      // IMPORTANT: Ensure all database operations are complete before showing the toast
      // This creates a small delay that helps ensure our redirection works properly
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now show the success toast
      toast({
        title: "Application Submitted Successfully",
        description: "Your driver application has been submitted and is pending review by our team.",
        duration: 5000,
      });

      // CRITICAL: Use window.location.href for direct browser navigation
      // This bypasses any potential Next.js routing issues
      console.log("🔄 REDIRECTING: Using direct browser navigation to /become-driver/confirmation");
      
      // Give the toast time to display before navigation
      setTimeout(() => {
        // Completely replace current URL to avoid any router interference
        window.location.replace('/become-driver/confirmation');
      }, 1500);
    } catch (error) {
      console.error("Error submitting driver application:", error)
      toast({
        title: "Error",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Become a Driver / Devenir chauffeur</h1>
          <p className="text-muted-foreground">
            Join our community of drivers and start earning more with PikDrive. /<br/>
            Rejoignez notre communauté de chauffeurs et gagnez plus avec PikDrive.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {requirements.map((section, index) => (
            <Card key={index} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {section.icon}
                  <h3 className="font-semibold">{section.title}</h3>
                </div>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-1 text-primary" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Driver Documents
                </h3>
                
                {/* National ID */}
                <div className="border rounded-lg p-4 bg-gray-50/50">
                  <h4 className="font-medium mb-2">National ID (CNI)</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="nationalIdNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>National ID Number / Numéro de CNI</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your CNI number / Entrez votre numéro CNI" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="nationalIdFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel>Upload ID Document / Télécharger la CNI</FormLabel>
                            {uploadingNationalId && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                          <FormControl>
                            <Input 
                              type="file" 
                              accept="image/*,application/pdf"
                              className="cursor-pointer"
                              disabled={uploadingNationalId || !!nationalIdFile}
                              onChange={handleNationalIdUpload}
                            />
                          </FormControl>
                          {nationalIdFile ? (
                            <div className="text-green-600 text-sm flex items-center gap-1">
                              <Check className="h-4 w-4" /> Document uploaded successfully
                            </div>
                          ) : (
                            <FormMessage className="text-red-500" />
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Driver License */}
                <div className="border rounded-lg p-4 bg-gray-50/50">
                  <h4 className="font-medium mb-2">Driver&apos;s License / Permis de conduire</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Number / Numéro de permis</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your license number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="licenseFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel>Upload License Document / Télécharger le permis</FormLabel>
                            {uploadingLicense && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                          <FormControl>
                            <Input 
                              type="file" 
                              accept="image/*,application/pdf"
                              className="cursor-pointer"
                              disabled={uploadingLicense || !!licenseFile}
                              onChange={handleLicenseUpload}
                            />
                          </FormControl>
                          {licenseFile ? (
                            <div className="text-green-600 text-sm flex items-center gap-1">
                              <Check className="h-4 w-4" /> Document uploaded successfully
                            </div>
                          ) : (
                            <FormMessage className="text-red-500" />
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  Vehicle Documents
                </h3>
                
                {/* Vehicle Registration */}
                <div className="border rounded-lg p-4 bg-gray-50/50">
                  <h4 className="font-medium mb-2">Vehicle Registration / Immatriculation</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="registrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Number / Numéro d&apos;immatriculation</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter registration number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="registrationFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel>Upload Registration Document / Télécharger l&apos;immatriculation</FormLabel>
                            {uploadingRegistration && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                          <FormControl>
                            <Input 
                              type="file" 
                              accept="image/*,application/pdf"
                              className="cursor-pointer"
                              disabled={uploadingRegistration || !!registrationFile}
                              onChange={handleRegistrationUpload}
                            />
                          </FormControl>
                          {registrationFile ? (
                            <div className="text-green-600 text-sm flex items-center gap-1">
                              <Check className="h-4 w-4" /> Document uploaded successfully
                            </div>
                          ) : (
                            <FormMessage className="text-red-500" />
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Insurance */}
                <div className="border rounded-lg p-4 bg-gray-50/50">
                  <h4 className="font-medium mb-2">Insurance / Assurance</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="insuranceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insurance Number / Numéro d&apos;assurance</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter insurance number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="insuranceFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel>Upload Insurance Document / Télécharger l&apos;assurance</FormLabel>
                            {uploadingInsurance && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                          <FormControl>
                            <Input 
                              type="file" 
                              accept="image/*,application/pdf"
                              className="cursor-pointer"
                              disabled={uploadingInsurance || !!insuranceFile}
                              onChange={handleInsuranceUpload}
                            />
                          </FormControl>
                          {insuranceFile ? (
                            <div className="text-green-600 text-sm flex items-center gap-1">
                              <Check className="h-4 w-4" /> Document uploaded successfully
                            </div>
                          ) : (
                            <FormMessage className="text-red-500" />
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Technical Inspection */}
                <div className="border rounded-lg p-4 bg-gray-50/50">
                  <h4 className="font-medium mb-2">Technical Inspection / Contrôle technique</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="technicalInspectionNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Technical Inspection Number / Numéro de contrôle technique</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter technical inspection number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="technicalInspectionFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel>Upload Technical Inspection Document / Télécharger le contrôle technique</FormLabel>
                            {uploadingTechnicalInspection && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                          <FormControl>
                            <Input 
                              type="file" 
                              accept="image/*,application/pdf"
                              className="cursor-pointer"
                              disabled={uploadingTechnicalInspection || !!technicalInspectionFile}
                              onChange={handleTechnicalInspectionUpload}
                            />
                          </FormControl>
                          {technicalInspectionFile ? (
                            <div className="text-green-600 text-sm flex items-center gap-1">
                              <Check className="h-4 w-4" /> Document uploaded successfully
                            </div>
                          ) : (
                            <FormMessage className="text-red-500" />
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Vehicle Images */}
              <div className="space-y-4 border rounded-lg p-5 bg-blue-50/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Additional Vehicle Images / Photos supplémentaires du véhicule
                </h3>
                <p className="text-sm text-muted-foreground">
                  Please upload clear images of your vehicle (exterior and interior views) /<br/>
                  Veuillez télécharger des images claires de votre véhicule (vues extérieures et intérieures)
                </p>
                <div className="grid gap-4">
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleVehicleImagesUpload}
                      disabled={vehicleImagesLoading}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-center mt-2 text-muted-foreground">
                      {vehicleImagesLoading ? "Uploading... / Téléchargement..." : "Drag and drop or click to select files / Glisser-déposer ou cliquer pour sélectionner des fichiers"}
                    </p>
                  </div>
                  
                  {vehicleImages.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Uploaded Images / Images téléchargées ({vehicleImages.length})</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {vehicleImages.map((url, index) => (
                          <div key={index} className="relative group rounded-lg overflow-hidden aspect-video shadow-sm">
                            <Image
                              src={url}
                              alt={`Vehicle image ${index + 1}`}
                              className="object-cover transition-transform group-hover:scale-105"
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting || vehicleImagesLoading || 
                  uploadingNationalId || uploadingLicense || 
                  uploadingRegistration || uploadingInsurance || 
                  uploadingTechnicalInspection}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting... / Soumission...
                  </span>
                ) : (
                  "Submit Application / Soumettre la demande"
                )}
              </Button>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  )
}