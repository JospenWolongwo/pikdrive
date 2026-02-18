"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSupabase } from "@/providers/SupabaseProvider"
import {
  Button,
  Card,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Input,
} from "@/components/ui"
import { toast } from "@/hooks/ui"
import { Loader2, Camera, User } from "lucide-react"
import { useEffect, useState } from "react"
import { useDriverStatus } from "@/hooks/useDriverStatus"
import { useRouter } from "next/navigation"
import { formSchema } from "../form-schema"
import * as z from "zod"
import {
  DriverRequirements,
  DriverDocuments,
  VehicleImagesUpload,
  DocumentFieldName,
  uploadDocument,
  isValidDocumentUrl,
} from "."
import { submitDriverApplication, DriverApplicationData } from "@/lib/driver-application-utils"
import { useLocale } from "@/hooks"
import { TermsAcceptance } from "@/components"
import { apiClient } from "@/lib/api-client"

export default function DriverApplicationForm() {
  const { supabase, user } = useSupabase()
  const router = useRouter()
  const { t } = useLocale()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [driverTermsAccepted, setDriverTermsAccepted] = useState(false)
  const { isApprovedDriver, isStatusLoading } = useDriverStatus(supabase, user?.id)

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

  // Initialize the form with Zod schema
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      nationalIdFileRecto: "",
      nationalIdFileVerso: "",
      licenseFileRecto: "",
      licenseFileVerso: "",
      registrationFileRecto: "",
      registrationFileVerso: "",
      insuranceFileRecto: "",
      insuranceFileVerso: "",
      vehicleImages: [],
    },
  })

  // driver status is handled by `useDriverStatus`

  // Generic document upload handler
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
      })
      return
    }

    try {
      setLoading(true)

      // Validate file type
      const fileExt = file.name.split(".").pop()?.toLowerCase()
      const allowedTypes = ["jpg", "jpeg", "png", "pdf"]

      if (!fileExt || !allowedTypes.includes(fileExt)) {
        toast({
          title: "Invalid File Type",
          description: `Please upload ${allowedTypes.join(", ")} files only.`,
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Maximum file size is 10MB.",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      // Use our utility function for more reliable uploads with better fallbacks
      const uploadResult = await uploadDocument(supabase, {
        file,
        userId: user.id,
        bucketName: "driver_documents",
        docType: formFieldName,
      })

      if (uploadResult.success) {
        const { url } = uploadResult

        setFileUrl(url)

        form.setValue(formFieldName, url, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        })

        toast({
          title: "Document Uploaded",
          description: "Your document has been uploaded successfully.",
        })
      } else {
        throw new Error(uploadResult.error || "Unknown upload error")
      }
    } catch (error) {
      console.error("Document upload failed:", error)

      let errorMessage = "There was an error uploading your document. Please try again."

      if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = String(error.message)
      }

      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Document upload handlers - recto (front)
  const handleNationalIdRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0],
        setUploadingNationalIdRecto,
        setNationalIdFileRecto,
        DocumentFieldName.NATIONAL_ID_RECTO
      )
    }
  }

  // Document upload handlers - verso (back)
  const handleNationalIdVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0],
        setUploadingNationalIdVerso,
        setNationalIdFileVerso,
        DocumentFieldName.NATIONAL_ID_VERSO
      )
    }
  }

  const handleLicenseRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0],
        setUploadingLicenseRecto,
        setLicenseFileRecto,
        DocumentFieldName.LICENSE_RECTO
      )
    }
  }

  const handleLicenseVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0],
        setUploadingLicenseVerso,
        setLicenseFileVerso,
        DocumentFieldName.LICENSE_VERSO
      )
    }
  }

  const handleRegistrationRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0],
        setUploadingRegistrationRecto,
        setRegistrationFileRecto,
        DocumentFieldName.REGISTRATION_RECTO
      )
    }
  }

  const handleRegistrationVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0],
        setUploadingRegistrationVerso,
        setRegistrationFileVerso,
        DocumentFieldName.REGISTRATION_VERSO
      )
    }
  }

  const handleInsuranceRectoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0],
        setUploadingInsuranceRecto,
        setInsuranceFileRecto,
        DocumentFieldName.INSURANCE_RECTO
      )
    }
  }

  const handleInsuranceVersoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentUpload(
        e.target.files[0],
        setUploadingInsuranceVerso,
        setInsuranceFileVerso,
        DocumentFieldName.INSURANCE_VERSO
      )
    }
  }

  // Vehicle images upload handler
  const handleVehicleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return

    setVehicleImagesLoading(true)

    Array.from(e.target.files).forEach(async (file) => {
      try {
        const uploadResult = await uploadDocument(supabase, {
          file,
          userId: user.id,
          bucketName: "driver_documents",
          docType: "vehicle_image",
        })

        if (uploadResult.success) {
          setVehicleImages((prev) => {
            const newImages = [...prev, uploadResult.url]
            form.setValue("vehicleImages", newImages)
            return newImages
          })
        }
      } catch (error) {
        console.error("Vehicle image upload failed:", error)
        toast({
          title: "Upload Failed",
          description: "There was an error uploading one of your vehicle images.",
          variant: "destructive",
        })
      } finally {
        setVehicleImagesLoading(false)
      }
    })
  }

  // Form submission handler
  const onSubmit = form.handleSubmit(async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to apply as a driver.",
        variant: "destructive",
      })
      return
    }

    const requiredDocs = [
      { name: "CNI (recto)", file: nationalIdFileRecto },
      { name: "CNI (verso)", file: nationalIdFileVerso },
      { name: "Permis (recto)", file: licenseFileRecto },
      { name: "Permis (verso)", file: licenseFileVerso },
      { name: "Carte Grise (recto)", file: registrationFileRecto },
      { name: "Carte Grise (verso)", file: registrationFileVerso },
      { name: "Certificat d'Assurance (recto)", file: insuranceFileRecto },
      { name: "Certificat d'Assurance (verso)", file: insuranceFileVerso },
    ]

    const missingDocs = requiredDocs.filter((doc) => !doc.file || !isValidDocumentUrl(doc.file))

    if (missingDocs.length > 0) {
      toast({
        title: t("pages.becomeDriver.form.errors.missingDocuments"),
        description: t("pages.becomeDriver.form.errors.missingDocumentsDesc", {
          documents: missingDocs.map((d) => d.name).join(", "),
        }),
        variant: "destructive",
      })
      return
    }

    if (!vehicleImages || vehicleImages.length === 0) {
      toast({
        title: t("pages.becomeDriver.form.errors.vehicleImagesRequired"),
        description: t("pages.becomeDriver.form.errors.vehicleImagesRequiredDesc"),
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const fullName = form.getValues("fullName")?.trim()
      if (!fullName || fullName.length < 2) {
        toast({
          title: t("pages.becomeDriver.form.errors.missingFullName"),
          description: t("pages.becomeDriver.form.errors.fullNameAsOnId"),
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }

      const driverData: DriverApplicationData = {
        driver_id: user.id,
        full_name: fullName,
        national_id_file_recto: nationalIdFileRecto,
        national_id_file_verso: nationalIdFileVerso,
        license_file_recto: licenseFileRecto,
        license_file_verso: licenseFileVerso,
        registration_file_recto: registrationFileRecto,
        registration_file_verso: registrationFileVerso,
        insurance_file_recto: insuranceFileRecto,
        insurance_file_verso: insuranceFileVerso,
        vehicle_images: vehicleImages,
      }

      const result = await submitDriverApplication(supabase, user.id, driverData)

      if (!result.success) {
        throw new Error(result.error || "Failed to submit application")
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token

        if (accessToken) {
          await apiClient.post(
            "/api/legal/consent",
            { consentType: "driver_terms", termsVersion: "1.0" },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
        }
      } catch (consentError) {
        console.error("Error storing driver consent:", consentError)
      }

      toast({
        title: t("pages.becomeDriver.form.errors.submitted"),
        description: t("pages.becomeDriver.form.errors.submittedDesc"),
      })

      router.push("/become-driver/confirmation")
    } catch (error) {
      console.error("Error submitting driver application:", error)
      toast({
        title: t("pages.becomeDriver.form.errors.error"),
        description: error instanceof Error ? error.message : t("pages.becomeDriver.form.errors.errorDesc"),
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  })
  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">{t("pages.becomeDriver.requirements.title")}</h2>
        <DriverRequirements />
      </div>

      {isStatusLoading ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("pages.becomeDriver.form.approved.loading")}</p>
        </Card>
      ) : isApprovedDriver ? (
        <Card className="p-6 border-primary/30 bg-primary/5">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{t("pages.becomeDriver.form.approved.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("pages.becomeDriver.form.approved.message")}</p>
            <div>
              <Button type="button" onClick={() => router.push("/driver/dashboard")}>{t("pages.becomeDriver.form.approved.button")}</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-8">
            <Card className="p-6">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    {t("pages.becomeDriver.form.fullNameLabel")} <span className="text-destructive">*</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.becomeDriver.form.fullNameHint")}
                  </p>
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={t("pages.becomeDriver.form.fullNamePlaceholder")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DriverDocuments
                  form={form}
                  nationalIdFileRecto={nationalIdFileRecto}
                  nationalIdFileVerso={nationalIdFileVerso}
                  licenseFileRecto={licenseFileRecto}
                  licenseFileVerso={licenseFileVerso}
                  registrationFileRecto={registrationFileRecto}
                  registrationFileVerso={registrationFileVerso}
                  insuranceFileRecto={insuranceFileRecto}
                  insuranceFileVerso={insuranceFileVerso}
                  uploadingNationalIdRecto={uploadingNationalIdRecto}
                  uploadingNationalIdVerso={uploadingNationalIdVerso}
                  uploadingLicenseRecto={uploadingLicenseRecto}
                  uploadingLicenseVerso={uploadingLicenseVerso}
                  uploadingRegistrationRecto={uploadingRegistrationRecto}
                  uploadingRegistrationVerso={uploadingRegistrationVerso}
                  uploadingInsuranceRecto={uploadingInsuranceRecto}
                  uploadingInsuranceVerso={uploadingInsuranceVerso}
                  handleNationalIdRectoUpload={handleNationalIdRectoUpload}
                  handleNationalIdVersoUpload={handleNationalIdVersoUpload}
                  handleLicenseRectoUpload={handleLicenseRectoUpload}
                  handleLicenseVersoUpload={handleLicenseVersoUpload}
                  handleRegistrationRectoUpload={handleRegistrationRectoUpload}
                  handleRegistrationVersoUpload={handleRegistrationVersoUpload}
                  handleInsuranceRectoUpload={handleInsuranceRectoUpload}
                  handleInsuranceVersoUpload={handleInsuranceVersoUpload}
                />

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    {t("pages.becomeDriver.vehicleImages.title")} <span className="text-destructive">*</span>
                  </h3>
                  <VehicleImagesUpload
                    images={vehicleImages}
                    isLoading={vehicleImagesLoading}
                    onUpload={handleVehicleImagesUpload}
                  />
                </div>
              </div>
            </Card>

            <div className="max-w-3xl mx-auto">
              <TermsAcceptance
                variant="detailed"
                type="driver"
                onAcceptanceChange={setDriverTermsAccepted}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full md:w-auto md:px-8 mx-auto block"
              disabled={isSubmitting || !driverTermsAccepted || !form.watch("fullName")?.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("pages.becomeDriver.form.submitting")}
                </>
              ) : t("pages.becomeDriver.form.submit")}
            </Button>
          </form>
        </Form>
      )}
    </>
  )
}

