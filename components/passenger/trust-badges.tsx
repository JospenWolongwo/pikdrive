import { Card, CardContent, Badge } from "@/components/ui";
import { Shield, CheckCircle } from "lucide-react";
import { useLocale } from "@/hooks";

interface TrustBadgesProps {
  verificationStatus: string;
  driverStatus: string;
}

export function TrustBadges({
  verificationStatus,
  driverStatus,
}: TrustBadgesProps) {
  const { t } = useLocale();
  const isVerified = verificationStatus === "approved" && driverStatus === "approved";

  if (!isVerified) {
    return null;
  }

  const badges = [
    {
      label: t("pages.driverProfile.trustBadges.badges.idVerified"),
      description: t("pages.driverProfile.trustBadges.badges.idVerifiedDesc"),
    },
    {
      label: t("pages.driverProfile.trustBadges.badges.licenseVerified"),
      description: t("pages.driverProfile.trustBadges.badges.licenseVerifiedDesc"),
    },
    {
      label: t("pages.driverProfile.trustBadges.badges.insuranceVerified"),
      description: t("pages.driverProfile.trustBadges.badges.insuranceVerifiedDesc"),
    },
  ];

  return (
    <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-full">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {t("pages.driverProfile.trustBadges.verifiedBy")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("pages.driverProfile.trustBadges.allDocumentsVerified")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {badges.map((badge, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="gap-1.5 bg-white/80 dark:bg-gray-800/80"
              >
                <CheckCircle className="h-3 w-3 text-green-600" />
                {badge.label}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

