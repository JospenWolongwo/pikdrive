import { useRouter } from "next/navigation";
import { useLocale } from "@/hooks";
import { Button } from "@/components/ui/button";
import {
  Car,
  Clock,
  AlertCircle,
  RefreshCw,
  LogOut,
} from "lucide-react";
import type { ProfileData } from "@/types/user";

interface ProfileHeaderProps {
  readonly profileData: ProfileData;
  readonly isLoading: boolean;
  readonly onRefresh: () => void;
  readonly onSignOut: () => void;
}

export function ProfileHeader({
  profileData,
  isLoading,
  onRefresh,
  onSignOut,
}: ProfileHeaderProps) {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {profileData.is_driver_applicant
            ? t("pages.profile.driverProfile")
            : t("pages.profile.userProfile")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("pages.profile.description")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {profileData.is_driver_applicant &&
          profileData.driver_status === "approved" && (
            <Button
              variant="outline"
              onClick={() => router.push("/driver/dashboard")}
              className="flex items-center justify-center gap-2"
            >
              <Car className="w-4 h-4" />
              <span>{t("pages.profile.dashboard")}</span>
            </Button>
          )}

        {profileData.is_driver_applicant &&
          profileData.driver_status === "pending" && (
            <Button
              variant="outline"
              onClick={() => router.push("/driver/pending")}
              className="flex items-center justify-center gap-2"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("pages.profile.applicationStatus")}
              </span>
              <span className="sm:hidden">{t("pages.profile.status.title")}</span>
            </Button>
          )}

        {profileData.is_driver_applicant &&
          profileData.driver_status === "rejected" && (
            <Button
              variant="outline"
              onClick={() => router.push("/driver/pending")}
              className="flex items-center justify-center gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t("pages.profile.viewRejectedStatus")}
              </span>
              <span className="sm:hidden">{t("pages.profile.status.title")}</span>
            </Button>
          )}

        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center justify-center gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          <span>{t("pages.profile.refresh")}</span>
        </Button>

        <Button
          variant="outline"
          onClick={onSignOut}
          className="flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("pages.profile.logout")}</span>
        </Button>
      </div>
    </div>
  );
}

