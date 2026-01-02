import { useLocale } from "@/hooks";
import { useAvatarUpload } from "@/hooks/profile";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Camera,
  Loader2,
  MapPin,
  Shield,
  Calendar,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ProfileData } from "@/types/user";
import type { User } from "@supabase/supabase-js";

interface ProfileOverviewCardProps {
  readonly profileData: ProfileData;
  readonly user: User | null;
  readonly userId: string | undefined;
  readonly onAvatarUpdated?: (avatarUrl: string) => void;
}

export function ProfileOverviewCard({
  profileData,
  user,
  userId,
  onAvatarUpdated,
}: ProfileOverviewCardProps) {
  const { t } = useLocale();
  const { getAvatarUrl, handleFileChange, isLoading: avatarLoading } =
    useAvatarUpload(userId, onAvatarUpdated);

  const avatarUrl = getAvatarUrl(profileData.avatar_url);

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-start gap-6">
          {/* Avatar Section */}
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-lg">
              {avatarUrl ? (
                <AvatarImage
                  src={avatarUrl}
                  alt={t("pages.profile.avatar.alt")}
                  className="object-cover"
                />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-primary to-amber-500 text-primary-foreground text-2xl font-bold">
                  {profileData.full_name
                    ? profileData.full_name[0].toUpperCase()
                    : user?.phone?.slice(-2) || "U"}
                </AvatarFallback>
              )}
            </Avatar>

            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-2 -right-2 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
            >
              {avatarLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              disabled={avatarLoading}
              className="hidden"
            />
          </div>

          {/* Profile Info */}
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-2xl font-bold">
                {profileData.full_name ||
                  t("pages.profile.personalInfo.nameNotDefined")}
              </h2>
              <p className="text-sm text-muted-foreground break-all">
                {profileData.email || user?.phone}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {profileData.city || t("pages.profile.cityNotDefined")}
                </span>
              </div>

              {profileData.is_driver_applicant && (
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <StatusBadge status={profileData.driver_status} />
                </div>
              )}
            </div>

            {profileData.is_driver_applicant &&
              profileData.driver_application_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {t("pages.profile.applicationSubmitted")}{" "}
                    {format(
                      new Date(profileData.driver_application_date),
                      "dd MMMM yyyy",
                      { locale: fr }
                    )}
                  </span>
                </div>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

