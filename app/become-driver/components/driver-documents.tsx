"use client"

import { Car, ShieldCheck } from "lucide-react"
import { DocumentUpload } from "./document-upload"
import { UseFormReturn } from "react-hook-form"
import { useLocale } from "@/hooks"

interface DriverDocumentsProps {
  form: UseFormReturn<any>
  // Document states
  nationalIdFileRecto: string
  nationalIdFileVerso: string
  licenseFileRecto: string
  licenseFileVerso: string
  registrationFileRecto: string
  registrationFileVerso: string
  insuranceFileRecto: string
  insuranceFileVerso: string
  
  // Loading states
  uploadingNationalIdRecto: boolean
  uploadingNationalIdVerso: boolean
  uploadingLicenseRecto: boolean
  uploadingLicenseVerso: boolean
  uploadingRegistrationRecto: boolean
  uploadingRegistrationVerso: boolean
  uploadingInsuranceRecto: boolean
  uploadingInsuranceVerso: boolean
  
  // Handlers
  handleNationalIdRectoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleNationalIdVersoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleLicenseRectoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleLicenseVersoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleRegistrationRectoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleRegistrationVersoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleInsuranceRectoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleInsuranceVersoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function DriverDocuments({
  form,
  nationalIdFileRecto,
  nationalIdFileVerso,
  licenseFileRecto,
  licenseFileVerso,
  registrationFileRecto,
  registrationFileVerso,
  insuranceFileRecto,
  insuranceFileVerso,
  uploadingNationalIdRecto,
  uploadingNationalIdVerso,
  uploadingLicenseRecto,
  uploadingLicenseVerso,
  uploadingRegistrationRecto,
  uploadingRegistrationVerso,
  uploadingInsuranceRecto,
  uploadingInsuranceVerso,
  handleNationalIdRectoUpload,
  handleNationalIdVersoUpload,
  handleLicenseRectoUpload,
  handleLicenseVersoUpload,
  handleRegistrationRectoUpload,
  handleRegistrationVersoUpload,
  handleInsuranceRectoUpload,
  handleInsuranceVersoUpload
}: DriverDocumentsProps) {
  const { t } = useLocale();
  
  return (
    <>
      {/* Driver Documents Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t("pages.becomeDriver.documents.driverDocuments.title")}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* National ID */}
          <DocumentUpload
            title={t("pages.becomeDriver.documents.nationalId.title")}
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            description={t("pages.becomeDriver.documents.nationalId.description")}
            formControl={form.control}
            rectoName="nationalIdFileRecto"
            versoName="nationalIdFileVerso"
            rectoValue={nationalIdFileRecto}
            versoValue={nationalIdFileVerso}
            uploadingRecto={uploadingNationalIdRecto}
            uploadingVerso={uploadingNationalIdVerso}
            onRectoUpload={handleNationalIdRectoUpload}
            onVersoUpload={handleNationalIdVersoUpload}
          />
          
          {/* Driver License */}
          <DocumentUpload
            title={t("pages.becomeDriver.documents.license.title")}
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            description={t("pages.becomeDriver.documents.license.description")}
            formControl={form.control}
            rectoName="licenseFileRecto"
            versoName="licenseFileVerso"
            rectoValue={licenseFileRecto}
            versoValue={licenseFileVerso}
            uploadingRecto={uploadingLicenseRecto}
            uploadingVerso={uploadingLicenseVerso}
            onRectoUpload={handleLicenseRectoUpload}
            onVersoUpload={handleLicenseVersoUpload}
          />
        </div>
      </div>

      {/* Vehicle Documents Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          {t("pages.becomeDriver.documents.vehicleDocuments.title")}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vehicle Registration */}
          <DocumentUpload
            title={t("pages.becomeDriver.documents.registration.title")}
            icon={<Car className="h-4 w-4 text-primary" />}
            description={t("pages.becomeDriver.documents.registration.description")}
            formControl={form.control}
            rectoName="registrationFileRecto"
            versoName="registrationFileVerso"
            rectoValue={registrationFileRecto}
            versoValue={registrationFileVerso}
            uploadingRecto={uploadingRegistrationRecto}
            uploadingVerso={uploadingRegistrationVerso}
            onRectoUpload={handleRegistrationRectoUpload}
            onVersoUpload={handleRegistrationVersoUpload}
          />
          
          {/* Insurance */}
          <DocumentUpload
            title={t("pages.becomeDriver.documents.insurance.title")}
            icon={<Car className="h-4 w-4 text-primary" />}
            description={t("pages.becomeDriver.documents.insurance.description")}
            formControl={form.control}
            rectoName="insuranceFileRecto"
            versoName="insuranceFileVerso"
            rectoValue={insuranceFileRecto}
            versoValue={insuranceFileVerso}
            uploadingRecto={uploadingInsuranceRecto}
            uploadingVerso={uploadingInsuranceVerso}
            onRectoUpload={handleInsuranceRectoUpload}
            onVersoUpload={handleInsuranceVersoUpload}
          />
        </div>
      </div>
    </>
  )
}
