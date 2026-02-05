import { useState } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useToast, useLocale } from "@/hooks";
import { ProfileService, ProfileStorageService } from "@/lib/services/client/profile";

interface UseAvatarUploadReturn {
  readonly handleFileChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
  readonly getAvatarUrl: (avatarUrl: string | null) => string | null;
  readonly isLoading: boolean;
}

export function useAvatarUpload(
  userId: string | undefined,
  onAvatarUpdated?: (avatarUrl: string) => void
): UseAvatarUploadReturn {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(false);

  const profileService = new ProfileService(supabase);
  const storageService = new ProfileStorageService(supabase);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !userId) return;

    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: t("pages.profile.error"),
        description: t("pages.profile.avatar.fileSizeError"),
      });
      return;
    }

    try {
      setIsLoading(true);

      const uploadResult = await storageService.uploadAvatar(userId, file);

      if (!uploadResult.success) {
        throw uploadResult.error;
      }

      const updateResult = await profileService.updateProfile(userId, {
        avatar_url: uploadResult.data.fileName,
        updated_at: new Date().toISOString(),
      });

      if (!updateResult.success) {
        throw updateResult.error;
      }

      if (onAvatarUpdated) {
        onAvatarUpdated(uploadResult.data.fileName);
      }

      toast({
        title: t("pages.profile.toast.success"),
        description: t("pages.profile.avatar.uploadSuccess"),
      });
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({
        variant: "destructive",
        title: t("pages.profile.error"),
        description: error.message || t("pages.profile.avatar.uploadError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getAvatarUrl = (avatarUrl: string | null): string | null => {
    return storageService.getAvatarUrl(avatarUrl);
  };

  return {
    handleFileChange,
    getAvatarUrl,
    isLoading,
  };
}

