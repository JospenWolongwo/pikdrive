import { useLocale } from "@/hooks";
import { useProfileForm } from "@/hooks/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Edit3,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { allCameroonCities } from "@/app/data/cities";
import type { ProfileData } from "@/types/user";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface PersonalInfoCardProps {
  readonly profileData: ProfileData | null;
  readonly user: SupabaseUser | null;
  readonly userId: string | undefined;
}

export function PersonalInfoCard({
  profileData,
  user,
  userId,
}: PersonalInfoCardProps) {
  const { t } = useLocale();
  const {
    formData,
    setFormData,
    handleSubmit,
    isEditing,
    setIsEditing,
    isLoading,
  } = useProfileForm(userId, profileData);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {t("pages.profile.personalInfo.title")}
          </CardTitle>
          <CardDescription>
            {t("pages.profile.personalInfo.description")}
          </CardDescription>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2"
        >
          {isEditing ? (
            <X className="w-4 h-4" />
          ) : (
            <Edit3 className="w-4 h-4" />
          )}
          {isEditing
            ? t("pages.profile.personalInfo.cancel")
            : t("pages.profile.personalInfo.edit")}
        </Button>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4" />{" "}
                {t("pages.profile.personalInfo.fullName")}
              </Label>
              <Input
                id="fullName"
                placeholder={t("pages.profile.personalInfo.fullNamePlaceholder")}
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    fullName: e.target.value,
                  }))
                }
                disabled={!isEditing || isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />{" "}
                {t("pages.profile.personalInfo.email")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("pages.profile.personalInfo.emailPlaceholder")}
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                disabled={!isEditing || isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />{" "}
                {t("pages.profile.personalInfo.phone")}
              </Label>
              <Input
                id="phone"
                value={profileData?.phone || user?.phone || ""}
                disabled={true}
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.profile.personalInfo.phoneCannotBeChanged")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />{" "}
                {t("pages.profile.personalInfo.city")}
              </Label>
              <SearchableSelect
                options={[...allCameroonCities]}
                value={formData.city}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, city: value }))
                }
                placeholder={t("pages.profile.selectCity")}
                searchPlaceholder={t("pages.profile.searchCity")}
                disabled={!isEditing || isLoading}
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
              >
                {t("pages.profile.personalInfo.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("pages.profile.personalInfo.saving")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t("pages.profile.personalInfo.save")}
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

