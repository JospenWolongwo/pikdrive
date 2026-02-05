import { useState, useEffect } from "react";
import { useSupabase } from "@/providers/SupabaseProvider";
import { ProfileService, DriverDocumentsService } from "@/lib/services/client/profile";
import type { ProfileData, DriverDocuments } from "@/types/user";

interface UseProfileReturn {
  readonly profileData: ProfileData | null;
  readonly driverDocuments: DriverDocuments | null;
  readonly isLoading: boolean;
  readonly refreshProfile: () => Promise<void>;
}

export function useProfile(userId: string | undefined): UseProfileReturn {
  const { supabase, user } = useSupabase();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [driverDocuments, setDriverDocuments] =
    useState<DriverDocuments | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const profileService = new ProfileService(supabase);
  const driverDocumentsService = new DriverDocumentsService(supabase);

  const loadProfile = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      // Load profile data
      let profileResult = await profileService.loadProfile(userId);

      // If profile doesn't exist, try to create it
      if (!profileResult.success && user) {
        const createResult = await profileService.createProfile(userId, {
          id: userId,
          phone: user.phone || null,
          email: user.email || null,
        });

        if (createResult.success) {
          profileResult = createResult;
        } else {
          console.error("[PROFILE] Error creating profile:", createResult.error);
          return;
        }
      }

      if (!profileResult.success) {
        console.error("[PROFILE] Error loading profile:", profileResult.error);
        return;
      }

      const profile = profileResult.data;
      setProfileData(profile);

      // Load driver documents if user is a driver applicant
      if (profile.is_driver_applicant) {
        console.log("[PROFILE] Loading driver documents for user:", userId);
        const documentsResult = await driverDocumentsService.loadDriverDocuments(
          userId
        );

        if (documentsResult.success) {
          if (documentsResult.data) {
            console.log(
              "[PROFILE] Driver documents loaded:",
              documentsResult.data
            );
            setDriverDocuments(documentsResult.data);
          } else {
            console.log("[PROFILE] No driver documents found for user");
            setDriverDocuments(null);
          }
        } else {
          console.error(
            "[PROFILE] Error loading driver documents:",
            documentsResult.error
          );
        }
      }
    } catch (error) {
      console.error("[PROFILE] Unexpected error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load profile on mount and when userId changes
  useEffect(() => {
    if (!userId) return;
    loadProfile();
  }, [userId]);

  // Real-time subscription to profile changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload: any) => {
          console.log("[PROFILE] Profile updated in real-time:", payload);
          if (payload.new) {
            setProfileData((prev) =>
              prev ? { ...prev, ...payload.new } : null
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  const refreshProfile = async () => {
    if (userId) {
      await loadProfile();
    }
  };

  return {
    profileData,
    driverDocuments,
    isLoading,
    refreshProfile,
  };
}

