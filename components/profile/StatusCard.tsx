import { useLocale } from "@/hooks";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge as BadgeComponent } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Badge } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ProfileData } from "@/types/user";

interface StatusCardProps {
  readonly profileData: ProfileData;
}

export function StatusCard({ profileData }: StatusCardProps) {
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge className="w-5 h-5" />
          {t("pages.profile.accountStatus.title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("pages.profile.accountStatus.accountType")}
            </span>
            <BadgeComponent variant="outline">
              {profileData.is_driver_applicant
                ? t("pages.profile.driver")
                : t("pages.profile.passenger")}
            </BadgeComponent>
          </div>

          {profileData.is_driver_applicant && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("pages.profile.driverStatus")}
              </span>
              <StatusBadge status={profileData.driver_status} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("pages.profile.accountStatus.role")}
            </span>
            <BadgeComponent variant="outline">
              {profileData.role === "admin"
                ? t("pages.profile.accountStatus.admin")
                : profileData.role === "driver"
                ? t("pages.profile.driver")
                : t("pages.profile.user")}
            </BadgeComponent>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("pages.profile.accountStatus.memberSince")}
            </span>
            <span>
              {profileData.created_at
                ? format(new Date(profileData.created_at), "MMM yyyy", {
                    locale: fr,
                  })
                : t("pages.profile.accountStatus.notAvailable")}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("pages.profile.accountStatus.lastUpdate")}
            </span>
            <span>
              {profileData.updated_at
                ? format(new Date(profileData.updated_at), "dd/MM/yyyy", {
                    locale: fr,
                  })
                : t("pages.profile.accountStatus.notAvailable")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

