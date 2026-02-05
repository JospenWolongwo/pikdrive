import { useLocale } from "@/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { FileText } from "lucide-react";
import { DriverDocumentImages } from "./DriverDocumentImages";
import { VehicleImagesSection } from "./VehicleImagesSection";
import type { ProfileData, DriverDocuments } from "@/types/user";

interface DriverDocumentsCardProps {
  readonly profileData: ProfileData;
  readonly driverDocuments: DriverDocuments | null;
  readonly userId: string | undefined;
  readonly onDocumentsUpdated?: (documents: DriverDocuments) => void;
}

export function DriverDocumentsCard({
  profileData,
  driverDocuments,
  userId,
  onDocumentsUpdated,
}: DriverDocumentsCardProps) {
  const { t } = useLocale();

  if (!profileData.is_driver_applicant) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {t("pages.profile.driverDocuments.title")}
        </CardTitle>
        <CardDescription>
          {t("pages.profile.driverDocuments.description")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          <DriverDocumentImages driverDocuments={driverDocuments} />
          <VehicleImagesSection
            driverId={profileData.is_driver_applicant ? userId : undefined}
            driverDocuments={driverDocuments}
            onDocumentsUpdated={onDocumentsUpdated}
          />
        </div>
      </CardContent>
    </Card>
  );
}

