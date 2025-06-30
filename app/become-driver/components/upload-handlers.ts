"use client"

import { useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { SupabaseClient } from "@supabase/supabase-js"
import { UseFormReturn } from "react-hook-form"
import { uploadDocument } from "../upload-utils"
import { DocumentFieldName } from "./document-types"
import { uploadVehicleImages } from "../vehicle-image-upload"

/**
 * Custom hook to create document upload handlers
 * This encapsulates all the document upload functionality in one place
 */
export function useDocumentUploadHandlers(
  supabase: SupabaseClient,
  form: UseFormReturn<any>,
  userId: string | undefined
) {
  // Document file upload states - recto (front)
  const [nationalIdFileRecto, setNationalIdFileRecto] = useState<string>("") 
  const [licenseFileRecto, setLicenseFileRecto] = useState<string>("") 
  const [registrationFileRecto, setRegistrationFileRecto] = useState<string>("") 
  const [insuranceFileRecto, setInsuranceFileRecto] = useState<string>("") 
  
  // Document file upload states - verso (back)
  const [nationalIdFileVerso, setNationalIdFileVerso] = useState<string>("") 
  const [licenseFileVerso, setLicenseFileVerso] = useState<string>("") 
  const [registrationFileVerso, setRegistrationFileVerso] = useState<string>("") 
  const [insuranceFileVerso, setInsuranceFileVerso] = useState<string>("") 
  
  // Loading states for each document - recto
  const [uploadingNationalIdRecto, setUploadingNationalIdRecto] = useState(false)
  const [uploadingLicenseRecto, setUploadingLicenseRecto] = useState(false)
  const [uploadingRegistrationRecto, setUploadingRegistrationRecto] = useState(false)
  const [uploadingInsuranceRecto, setUploadingInsuranceRecto] = useState(false)
  
  // Loading states for each document - verso
  const [uploadingNationalIdVerso, setUploadingNationalIdVerso] = useState(false)
  const [uploadingLicenseVerso, setUploadingLicenseVerso] = useState(false)
  const [uploadingRegistrationVerso, setUploadingRegistrationVerso] = useState(false)
  const [uploadingInsuranceVerso, setUploadingInsuranceVerso] = useState(false)

  // Vehicle images state
  const [vehicleImages, setVehicleImages] = useState<string[]>([])
  const [vehicleImagesLoading, setVehicleImagesLoading] = useState(false)

  // Generic document upload handler
  const handleDocumentUpload = async (
    file: File, 
    setLoading: (loading: boolean) => void, 
    setFileUrl: (url: string) => void, 
    formFieldName: DocumentFieldName
  ) => {
    if (!userId) {
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
        userId,
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
  };

  // Individual document upload handlers - recto (front)
  const handleNationalIdRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0], 
        setUploadingNationalIdRecto, 
        setNationalIdFileRecto,
        DocumentFieldName.NATIONAL_ID_RECTO
      );
    }
  };

  // Individual document upload handlers - verso (back)
  const handleNationalIdVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0], 
        setUploadingNationalIdVerso, 
        setNationalIdFileVerso,
        DocumentFieldName.NATIONAL_ID_VERSO
      );
    }
  };

  const handleLicenseRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0], 
        setUploadingLicenseRecto, 
        setLicenseFileRecto,
        DocumentFieldName.LICENSE_RECTO
      );
    }
  };

  const handleLicenseVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0], 
        setUploadingLicenseVerso, 
        setLicenseFileVerso,
        DocumentFieldName.LICENSE_VERSO
      );
    }
  };

  const handleRegistrationRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0], 
        setUploadingRegistrationRecto, 
        setRegistrationFileRecto,
        DocumentFieldName.REGISTRATION_RECTO
      );
    }
  };

  const handleRegistrationVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0], 
        setUploadingRegistrationVerso, 
        setRegistrationFileVerso,
        DocumentFieldName.REGISTRATION_VERSO
      );
    }
  };

  const handleInsuranceRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0], 
        setUploadingInsuranceRecto, 
        setInsuranceFileRecto,
        DocumentFieldName.INSURANCE_RECTO
      );
    }
  };

  const handleInsuranceVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0], 
        setUploadingInsuranceVerso, 
        setInsuranceFileVerso,
        DocumentFieldName.INSURANCE_VERSO
      );
    }
  };

  // Enhanced vehicle images upload handler with optimized state management
  const handleVehicleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload images.",
        variant: "destructive",
      });
      return;
    }
    
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      setVehicleImagesLoading(true);
      
      // For vehicle images, we use the specialized multi-image upload function
      const uploadResult = await uploadVehicleImages(
        supabase, 
        Array.from(files),
        userId
      );
      
      if (uploadResult.success) {
        // Use functional state update pattern to ensure we're always appending to the current state
        setVehicleImages(prevImages => {
          // Combine previous images with newly uploaded ones
          const newImages = [...prevImages, ...uploadResult.urls];
          
          // Update the form value with all images
          form.setValue("vehicleImages", newImages, {
            shouldValidate: true,
            shouldDirty: true,
          });
          
          // Log success with timestamp
          console.log(`✅ Uploaded ${uploadResult.urls.length} vehicle images. Total: ${newImages.length}`);
          
          return newImages;
        });
        
        // Show success toast
        toast({
          title: "Images Uploaded",
          description: `Successfully uploaded ${uploadResult.urls.length} images.`,
        });
      } else {
        throw new Error(uploadResult.error || 'Unknown upload error');
      }
    } catch (error) {
      console.error("❌ Vehicle image upload failed:", error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVehicleImagesLoading(false);
    }
  };

  return {
    // Document states
    nationalIdFileRecto,
    nationalIdFileVerso,
    licenseFileRecto,
    licenseFileVerso,
    registrationFileRecto,
    registrationFileVerso,
    insuranceFileRecto,
    insuranceFileVerso,
    vehicleImages,
    vehicleImagesLoading,
    
    // Loading states
    uploadingNationalIdRecto,
    uploadingNationalIdVerso,
    uploadingLicenseRecto,
    uploadingLicenseVerso,
    uploadingRegistrationRecto,
    uploadingRegistrationVerso,
    uploadingInsuranceRecto,
    uploadingInsuranceVerso,
    
    // Handlers
    handleNationalIdRectoUpload,
    handleNationalIdVersoUpload,
    handleLicenseRectoUpload,
    handleLicenseVersoUpload,
    handleRegistrationRectoUpload,
    handleRegistrationVersoUpload,
    handleInsuranceRectoUpload,
    handleInsuranceVersoUpload,
    handleVehicleImagesUpload
  };
}
