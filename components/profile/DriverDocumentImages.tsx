import { useLocale } from "@/hooks";
import { FileText } from "lucide-react";
import type { DriverDocuments } from "@/types/user";

interface DriverDocumentImagesProps {
  readonly driverDocuments: DriverDocuments | null;
}

export function DriverDocumentImages({
  driverDocuments,
}: DriverDocumentImagesProps) {
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
        {t("pages.profile.driverDocuments.submittedDocuments")}
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CNI */}
        <div className="space-y-2">
          <h5 className="font-medium text-sm">
            {t("pages.profile.driverDocuments.nationalId")}
          </h5>
          <div className="grid grid-cols-2 gap-2">
            {driverDocuments?.national_id_file_recto && (
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                <img
                  src={driverDocuments.national_id_file_recto}
                  alt={t("pages.profile.driverDocuments.nationalIdRecto")}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            {driverDocuments?.national_id_file_verso && (
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                <img
                  src={driverDocuments.national_id_file_verso}
                  alt={t("pages.profile.driverDocuments.nationalIdVerso")}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* License */}
        <div className="space-y-2">
          <h5 className="font-medium text-sm">
            {t("pages.profile.driverDocuments.drivingLicense")}
          </h5>
          <div className="grid grid-cols-2 gap-2">
            {driverDocuments?.license_file_recto && (
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                <img
                  src={driverDocuments.license_file_recto}
                  alt={t("pages.profile.driverDocuments.licenseRecto")}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            {driverDocuments?.license_file_verso && (
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                <img
                  src={driverDocuments.license_file_verso}
                  alt={t("pages.profile.driverDocuments.licenseVerso")}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Registration */}
        <div className="space-y-2">
          <h5 className="font-medium text-sm">
            {t("pages.profile.driverDocuments.registrationCard")}
          </h5>
          <div className="grid grid-cols-2 gap-2">
            {driverDocuments?.registration_file_recto && (
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                <img
                  src={driverDocuments.registration_file_recto}
                  alt={t("pages.profile.driverDocuments.registrationRecto")}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            {driverDocuments?.registration_file_verso && (
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                <img
                  src={driverDocuments.registration_file_verso}
                  alt={t("pages.profile.driverDocuments.registrationVerso")}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Insurance */}
        <div className="space-y-2">
          <h5 className="font-medium text-sm">
            {t("pages.profile.driverDocuments.insurance")}
          </h5>
          <div className="grid grid-cols-2 gap-2">
            {driverDocuments?.insurance_file_recto && (
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                <img
                  src={driverDocuments.insurance_file_recto}
                  alt={t("pages.profile.driverDocuments.insuranceRecto")}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            {driverDocuments?.insurance_file_verso && (
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
                <img
                  src={driverDocuments.insurance_file_verso}
                  alt={t("pages.profile.driverDocuments.insuranceVerso")}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Show message when no driver documents exist yet */}
      {!driverDocuments && (
        <div className="text-center py-6 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {t("pages.profile.driverDocuments.noDocuments")}
          </p>
          <p className="text-xs mt-1">
            {t("pages.profile.driverDocuments.noDocumentsDescription")}
          </p>
        </div>
      )}
    </div>
  );
}

