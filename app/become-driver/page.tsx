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
    title: "Documents Véhicule Requis",
    items: [
      "Carte Grise du Véhicule",
      "Certificat d'Assurance"
    ]
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-primary" />,
    title: "Documents Conducteur Requis",
    items: [
      "Carte Nationale d'Identité (CNI)",
      "Permis de Conduire"
    ]
  },
  {
    icon: <DollarSign className="w-6 h-6 text-primary" />,
    title: "Avantages",
    items: [
      "Gagnez plus avec les trajets longue distance",
      "Paiements hebdomadaires",
      "Horaires flexibles",
      "Assistance 24/7"
    ]
  }
]

const formSchema = z.object({
  // Document files - the focus of our simplified form
  // using optional() to allow empty string during form initialization,
  // but we'll validate these separately before form submission
  nationalIdFile: z.string().optional(),
  licenseFile: z.string().optional(),
  registrationFile: z.string().optional(),
  insuranceFile: z.string().optional(),
  
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
  
  // Loading states for each document
  const [uploadingNationalId, setUploadingNationalId] = useState(false)
  const [uploadingLicense, setUploadingLicense] = useState(false)
  const [uploadingRegistration, setUploadingRegistration] = useState(false)
  const [uploadingInsurance, setUploadingInsurance] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nationalIdFile: "",
      licenseFile: "",
      registrationFile: "",
      insuranceFile: "",
      vehicleImages: [],
    },
  })

  // Professional production-ready document upload function using our utility module
  // Define valid form field names for document uploads
  type DocumentFieldName = "nationalIdFile" | "licenseFile" | "registrationFile" | "insuranceFile";
  
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

  // Technical inspection handler removed as per simplified requirements

  // Enhanced vehicle images upload handler with optimized state management
  const handleVehicleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    if (!user) return

    setVehicleImagesLoading(true)
    const startTime = performance.now();
    console.log(`🚗 Début du téléchargement des photos du véhicule`)

    try {
      const filesToUpload: File[] = []
      const validationResults: { valid: boolean; message?: string }[] = []
      
      // Validate all files first to give complete feedback
      Array.from(e.target.files).forEach(file => {
        const fileExt = file.name.split(".").pop()?.toLowerCase()
        const fileSize = file.size / 1024 / 1024 // Size in MB

        if (!fileExt || !["jpg", "jpeg", "png"].includes(fileExt)) {
          validationResults.push({ 
            valid: false, 
            message: `Le fichier "${file.name}" n'est pas au format JPG ou PNG.`
          })
        } else if (fileSize > 5) {
          validationResults.push({ 
            valid: false, 
            message: `Le fichier "${file.name}" dépasse 5Mo.`
          })
        } else {
          validationResults.push({ valid: true })
          filesToUpload.push(file)
        }
      })
      
      // Show validation feedback
      const invalidResults = validationResults.filter(r => !r.valid)
      if (invalidResults.length > 0) {
        if (invalidResults.length <= 3) {
          // Show specific errors if there aren't too many
          invalidResults.forEach(result => {
            if (result.message) {
              toast({
                description: result.message,
                variant: "destructive",
              })
            }
          })
        } else {
          // Show a summary if there are many errors
          toast({
            title: "Erreurs de validation",
            description: `${invalidResults.length} fichiers ne respectent pas les critères (format JPG/PNG, max 5Mo)`,
            variant: "destructive",
          })
        }
      }
      
      if (filesToUpload.length === 0) {
        toast({
          title: "Aucune image valide",
          description: "Aucun fichier sélectionné ne respecte les critères de téléchargement.",
          variant: "destructive",
        })
        setVehicleImagesLoading(false)
        return
      }
      
      // Use parallel processing for better performance
      console.log(`📤 Téléchargement de ${filesToUpload.length} photos...`)
      const uploadResult = await uploadVehicleImages(supabase, filesToUpload, user.id)
      
      // Use functional state updates to ensure atomic operations
      if (uploadResult.urls.length > 0) {
        // Update state with new timestamp to force re-render
        setVehicleImages(prev => {
          const updatedImages = [...prev, ...uploadResult.urls]
          
          // Update form value
          form.setValue("vehicleImages", updatedImages, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true
          })
          
          return updatedImages
        })
        
        // Success messages
        if (uploadResult.success) {
          const uploadTime = ((performance.now() - startTime) / 1000).toFixed(1)
          toast({
            title: "Photos ajoutées",
            description: `${uploadResult.urls.length} photo${uploadResult.urls.length > 1 ? 's' : ''} téléchargée${uploadResult.urls.length > 1 ? 's' : ''} avec succès (${uploadTime}s)`,
          })
          console.log(`✅ Téléchargement terminé en ${uploadTime}s`)
        } else {
          toast({
            title: "Téléchargement partiel",
            description: `${uploadResult.urls.length} image${uploadResult.urls.length > 1 ? 's' : ''} téléchargée${uploadResult.urls.length > 1 ? 's' : ''}, ${uploadResult.errors.length} échec${uploadResult.errors.length > 1 ? 's' : ''}.`,
            variant: "default",
          })
          console.log(`⚠️ Téléchargement partiel: ${uploadResult.urls.length} succès, ${uploadResult.errors.length} échecs`)
        }
      } else {
        // Complete failure
        toast({
          title: "Échec du téléchargement",
          description: "Impossible de télécharger les photos. Veuillez réessayer.",
          variant: "destructive",
        })
        console.error(`❌ Échec total du téléchargement des images`)
      }
    } catch (error) {
      console.error("❌ Erreur lors du téléchargement des photos:", error)
      toast({
        title: "Erreur de téléchargement",
        description: "Une erreur inattendue s'est produite. Veuillez réessayer.",
        variant: "destructive",
      })
    } finally {
      // Always make sure to reset the loading state
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
    // Technical inspection removed from required docs
    console.log("🔍 Vehicle Images:", vehicleImages?.length || 0)
    
    // Pre-flight validation to ensure we have all required files
    const missingDocuments = [];
    
    // Comprehensive validation check for document files
    // Checks both existence and non-empty strings
    if (!nationalIdFile || nationalIdFile.trim() === "") missingDocuments.push("Carte d'identité");
    if (!licenseFile || licenseFile.trim() === "") missingDocuments.push("Permis de conduire");
    if (!registrationFile || registrationFile.trim() === "") missingDocuments.push("Carte grise");
    if (!insuranceFile || insuranceFile.trim() === "") missingDocuments.push("Assurance");
    // Technical inspection validation removed as per simplified requirements
    
    if (missingDocuments.length > 0) {
      console.error("❌ Missing required documents:", missingDocuments);
      toast({
        title: "Documents Manquants",
        description: `Veuillez télécharger les documents requis suivants: ${missingDocuments.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validate all document file URLs (can be Supabase or mock URLs in dev mode)
    const documentFiles = [
      nationalIdFile,
      licenseFile,
      registrationFile,
      insuranceFile
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
        // Document numbers are now optional in our simplified approach
        national_id_number: "",
        license_number: "",
        registration_number: "",
        insurance_number: "",
        // Document files stored as fully validated URLs
        national_id_file: nationalIdFile,
        license_file: licenseFile,
        registration_file: registrationFile,
        insurance_file: insuranceFile,
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
              // Using empty strings for document numbers in our simplified approach
              national_id_number: "",
              license_number: "",
              registration_number: "",
              insurance_number: "",
              national_id_file: nationalIdFile,
              license_file: licenseFile,
              registration_file: registrationFile,
              insurance_file: insuranceFile,
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
                  Documents du Conducteur
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* National ID */}
                  <div className="border rounded-lg p-5 bg-gray-50/50 hover:bg-blue-50/20 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Carte Nationale d'Identité (CNI)
                      </h4>
                      {nationalIdFile && <Check className="h-5 w-5 text-green-600" />}
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="nationalIdFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="text-sm text-muted-foreground mb-2">
                            Téléchargez une image claire de votre CNI
                          </div>
                          <div className="flex flex-col gap-3">
                            <div className="relative border-2 border-dashed rounded-lg p-4 hover:bg-slate-50 transition-colors">
                              <FormControl>
                                <Input 
                                  type="file" 
                                  accept="image/*,application/pdf"
                                  className="cursor-pointer z-20 relative opacity-0 h-32"
                                  disabled={uploadingNationalId || !!nationalIdFile}
                                  onChange={handleNationalIdUpload}
                                />
                              </FormControl>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                {uploadingNationalId ? (
                                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                                ) : nationalIdFile ? (
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Check className="h-8 w-8 text-green-600" />
                                    <span className="text-green-600 font-medium">Document téléchargé</span>
                                  </div>
                                ) : (
                                  <>
                                    <ShieldCheck className="h-10 w-10 text-muted-foreground mb-2" />
                                    <p className="text-center font-medium">Cliquez ou déposez ici</p>
                                    <p className="text-xs text-muted-foreground">JPG, PNG ou PDF</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Driver License */}
                  <div className="border rounded-lg p-5 bg-gray-50/50 hover:bg-blue-50/20 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Permis de Conduire
                      </h4>
                      {licenseFile && <Check className="h-5 w-5 text-green-600" />}
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="licenseFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="text-sm text-muted-foreground mb-2">
                            Téléchargez une image claire de votre permis de conduire
                          </div>
                          <div className="flex flex-col gap-3">
                            <div className="relative border-2 border-dashed rounded-lg p-4 hover:bg-slate-50 transition-colors">
                              <FormControl>
                                <Input 
                                  type="file" 
                                  accept="image/*,application/pdf"
                                  className="cursor-pointer z-20 relative opacity-0 h-32"
                                  disabled={uploadingLicense || !!licenseFile}
                                  onChange={handleLicenseUpload}
                                />
                              </FormControl>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                {uploadingLicense ? (
                                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                                ) : licenseFile ? (
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Check className="h-8 w-8 text-green-600" />
                                    <span className="text-green-600 font-medium">Document téléchargé</span>
                                  </div>
                                ) : (
                                  <>
                                    <ShieldCheck className="h-10 w-10 text-muted-foreground mb-2" />
                                    <p className="text-center font-medium">Cliquez ou déposez ici</p>
                                    <p className="text-xs text-muted-foreground">JPG, PNG ou PDF</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  Documents du Véhicule
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vehicle Registration */}
                  <div className="border rounded-lg p-5 bg-gray-50/50 hover:bg-blue-50/20 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Car className="h-4 w-4 text-primary" />
                        Carte Grise du Véhicule
                      </h4>
                      {registrationFile && <Check className="h-5 w-5 text-green-600" />}
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="registrationFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="text-sm text-muted-foreground mb-2">
                            Téléchargez une image claire de la carte grise du véhicule
                          </div>
                          <div className="flex flex-col gap-3">
                            <div className="relative border-2 border-dashed rounded-lg p-4 hover:bg-slate-50 transition-colors">
                              <FormControl>
                                <Input 
                                  type="file" 
                                  accept="image/*,application/pdf"
                                  className="cursor-pointer z-20 relative opacity-0 h-32"
                                  disabled={uploadingRegistration || !!registrationFile}
                                  onChange={handleRegistrationUpload}
                                />
                              </FormControl>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                {uploadingRegistration ? (
                                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                                ) : registrationFile ? (
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Check className="h-8 w-8 text-green-600" />
                                    <span className="text-green-600 font-medium">Document téléchargé</span>
                                  </div>
                                ) : (
                                  <>
                                    <Car className="h-10 w-10 text-muted-foreground mb-2" />
                                    <p className="text-center font-medium">Cliquez ou déposez ici</p>
                                    <p className="text-xs text-muted-foreground">JPG, PNG ou PDF</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Insurance */}
                  <div className="border rounded-lg p-5 bg-gray-50/50 hover:bg-blue-50/20 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Car className="h-4 w-4 text-primary" />
                        Certificat d'Assurance
                      </h4>
                      {insuranceFile && <Check className="h-5 w-5 text-green-600" />}
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="insuranceFile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="text-sm text-muted-foreground mb-2">
                            Téléchargez une image claire de votre certificat d'assurance
                          </div>
                          <div className="flex flex-col gap-3">
                            <div className="relative border-2 border-dashed rounded-lg p-4 hover:bg-slate-50 transition-colors">
                              <FormControl>
                                <Input 
                                  type="file" 
                                  accept="image/*,application/pdf"
                                  className="cursor-pointer z-20 relative opacity-0 h-32"
                                  disabled={uploadingInsurance || !!insuranceFile}
                                  onChange={handleInsuranceUpload}
                                />
                              </FormControl>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                {uploadingInsurance ? (
                                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                                ) : insuranceFile ? (
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Check className="h-8 w-8 text-green-600" />
                                    <span className="text-green-600 font-medium">Document téléchargé</span>
                                  </div>
                                ) : (
                                  <>
                                    <Car className="h-10 w-10 text-muted-foreground mb-2" />
                                    <p className="text-center font-medium">Cliquez ou déposez ici</p>
                                    <p className="text-xs text-muted-foreground">JPG, PNG ou PDF</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Images Section */}
              <div className="space-y-6 border rounded-lg p-6 bg-gradient-to-b from-blue-50/50 to-slate-50/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    Photos du Véhicule
                  </h3>
                  {vehicleImages.length > 0 && (
                    <span className="text-sm bg-green-100 text-green-800 py-1 px-2 rounded-full flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      {vehicleImages.length} image{vehicleImages.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="bg-white/80 rounded-lg p-4 shadow-sm">
                  <p className="text-sm text-gray-600 mb-4">
                    Veuillez télécharger des photos claires de votre véhicule pour compléter votre inscription.
                    Nous recommandons des photos de l'avant, l'arrière, les côtés et l'intérieur.
                  </p>
                  
                  <div className="relative min-h-[180px] border-2 border-dashed border-primary/20 rounded-lg hover:bg-slate-50/80 transition-all group">
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
                      {vehicleImagesLoading ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
                          <p className="text-primary font-medium">Téléchargement en cours...</p>
                          <p className="text-xs text-muted-foreground mt-1">Veuillez patienter pendant le traitement des images</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center">
                          <Upload className="h-12 w-12 text-primary/70 mb-2 group-hover:text-primary transition-colors" />
                          <p className="font-medium text-gray-700 group-hover:text-gray-900">
                            Cliquez ou déposez vos photos ici
                          </p>
                          <p className="text-xs text-gray-500 mt-1 max-w-xs">
                            Vous pouvez sélectionner plusieurs images à la fois. Format accepté: JPG, PNG
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleVehicleImagesUpload}
                      disabled={vehicleImagesLoading}
                      className="cursor-pointer opacity-0 absolute inset-0 h-full z-10"
                    />
                  </div>
                </div>
                
                {vehicleImages.length > 0 && (
                  <div className="bg-white/80 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Photos téléchargées</h4>
                      <span className="text-xs text-muted-foreground">{vehicleImages.length} image{vehicleImages.length > 1 ? 's' : ''}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {vehicleImages.map((url, index) => (
                        <div key={index} className="relative group rounded-lg overflow-hidden aspect-square shadow-sm border border-gray-100">
                          <Image
                            src={url}
                            alt={`Photo du véhicule ${index + 1}`}
                            className="object-cover transition-all group-hover:scale-105 group-hover:brightness-90"
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                            <span className="text-white text-xs font-medium">Photo {index + 1}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting || vehicleImagesLoading || 
                  uploadingNationalId || uploadingLicense || 
                  uploadingRegistration || uploadingInsurance}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Soumission en cours...
                  </span>
                ) : (
                  "Soumettre la demande"
                )}
              </Button>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  )
}