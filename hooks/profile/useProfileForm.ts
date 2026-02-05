import { useState, useEffect } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useToast } from "@/hooks";
import { useLocale } from "@/hooks";
import { ProfileService } from "@/lib/services/client/profile";
import type { ProfileData } from "@/types/user";

interface FormData {
  readonly fullName: string;
  readonly email: string;
  readonly city: string;
}

interface UseProfileFormReturn {
  readonly formData: FormData;
  readonly setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  readonly handleSubmit: (e: React.FormEvent) => Promise<void>;
  readonly isEditing: boolean;
  readonly setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  readonly isLoading: boolean;
}

export function useProfileForm(
  userId: string | undefined,
  profileData: ProfileData | null
): UseProfileFormReturn {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const { t } = useLocale();
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: "",
    city: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const profileService = new ProfileService(supabase);

  // Update form data when profile data changes
  useEffect(() => {
    if (profileData) {
      setFormData({
        fullName: profileData.full_name || "",
        email: profileData.email || "",
        city: profileData.city || "",
      });
    }
  }, [profileData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) return;

    try {
      setIsLoading(true);

      const result = await profileService.updateProfile(userId, {
        full_name: formData.fullName,
        email: formData.email,
        city: formData.city,
        updated_at: new Date().toISOString(),
      });

      if (!result.success) {
        throw result.error;
      }

      setIsEditing(false);

      toast({
        title: t("pages.profile.toast.success"),
        description: t("pages.profile.toast.profileUpdated"),
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("pages.profile.error"),
        description: error.message || t("pages.profile.toast.updateFailed"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    handleSubmit,
    isEditing,
    setIsEditing,
    isLoading,
  };
}

