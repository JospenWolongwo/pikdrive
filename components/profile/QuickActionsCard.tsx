import { useRouter } from "next/navigation";
import { useLocale } from "@/hooks";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  Settings,
  Car,
  Clock,
  MapPin,
  Calendar,
} from "lucide-react";
import type { ProfileData } from "@/types/user";

interface QuickActionsCardProps {
  readonly profileData: ProfileData;
}

export function QuickActionsCard({ profileData }: QuickActionsCardProps) {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          {t("pages.profile.quickActions.title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {!profileData.is_driver_applicant && (
          <Button
            onClick={() => router.push("/become-driver")}
            className="w-full justify-start"
            variant="outline"
          >
            <Car className="w-4 h-4 mr-2" />
            {t("pages.profile.becomeDriver")}
          </Button>
        )}

        {profileData.is_driver_applicant &&
          profileData.driver_status === "approved" && (
            <Button
              onClick={() => router.push("/driver/rides/new")}
              className="w-full justify-start"
            >
              <Car className="w-4 h-4 mr-2" />
              {t("pages.profile.quickActions.publishRide")}
            </Button>
          )}

        {profileData.is_driver_applicant &&
          profileData.driver_status === "pending" && (
            <Button
              onClick={() => router.push("/driver/pending")}
              className="w-full justify-start"
              variant="outline"
            >
              <Clock className="w-4 h-4 mr-2" />
              {t("pages.profile.viewStatus")}
            </Button>
          )}

        <Button
          onClick={() => router.push("/rides")}
          className="w-full justify-start"
          variant="outline"
        >
          <MapPin className="w-4 h-4 mr-2" />
          {t("pages.profile.quickActions.viewRides")}
        </Button>

        <Button
          onClick={() => router.push("/bookings")}
          className="w-full justify-start"
          variant="outline"
        >
          <Calendar className="w-4 h-4 mr-2" />
          {t("pages.profile.quickActions.myBookings")}
        </Button>
      </CardContent>
    </Card>
  );
}

