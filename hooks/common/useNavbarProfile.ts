"use client";

import { useState, useEffect } from "react";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSupabase } from "@/providers/SupabaseProvider";
import { withCacheBuster } from "@/lib/utils/cache-buster";

interface NavbarProfile {
  readonly isDriver: boolean;
  readonly driverStatus: string | null;
  readonly avatarUrl: string | null;
  readonly fullName: string | null;
}

/**
 * Fetches the current user's profile for the navbar and subscribes
 * to real-time updates so avatar, name, and driver status stay in sync.
 */
export function useNavbarProfile(): NavbarProfile {
  const { supabase, user } = useSupabase();
  const [isDriver, setIsDriver] = useState(false);
  const [driverStatus, setDriverStatus] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const resolveAvatarUrl = (path: string | null) => {
      if (!path) return null;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      return withCacheBuster(publicUrl);
    };

    const applyProfile = (profile: {
      is_driver?: boolean;
      driver_status?: string | null;
      avatar_url?: string | null;
      full_name?: string | null;
    }) => {
      setIsDriver(profile.is_driver || false);
      setDriverStatus(profile.driver_status || null);
      setFullName(profile.full_name || null);
      setAvatarUrl(resolveAvatarUrl(profile.avatar_url ?? null));
    };

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_driver, driver_status, avatar_url, full_name")
        .eq("id", user.id)
        .maybeSingle();

      // Profile doesn't exist yet — create it
      if ((error && error.code === "PGRST116") || !data) {
        const { error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            phone: user.phone || null,
            email: user.email || null,
            full_name: null,
            city: null,
            avatar_url: null,
            is_driver: false,
            driver_status: "pending",
            role: "user",
            driver_application_status: "pending",
            driver_application_date: null,
            is_driver_applicant: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        // Race condition: profile was created between our read and write
        if (createError && (createError.code === "23505" || createError.message?.includes("duplicate"))) {
          const { data: existing } = await supabase
            .from("profiles")
            .select("is_driver, driver_status, avatar_url, full_name")
            .eq("id", user.id)
            .single();
          if (existing) applyProfile(existing);
          return;
        }

        if (!createError) {
          const { data: created } = await supabase
            .from("profiles")
            .select("is_driver, driver_status, avatar_url, full_name")
            .eq("id", user.id)
            .single();
          if (created) applyProfile(created);
        }
        return;
      }

      applyProfile(data);
    };

    fetchProfile();

    // Real-time subscription keeps navbar in sync without page reload
    const channel = supabase
      .channel(`profile-updates-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<{
          is_driver: boolean;
          driver_status: string;
          avatar_url: string | null;
          full_name: string | null;
        }>) => {
          const updated = payload.new as {
            is_driver?: boolean;
            driver_status?: string;
            avatar_url?: string | null;
            full_name?: string | null;
          };

          if (updated.is_driver !== undefined) setIsDriver(updated.is_driver);
          if (updated.driver_status !== undefined) setDriverStatus(updated.driver_status);
          if (updated.full_name !== undefined) setFullName(updated.full_name);
          if (updated.avatar_url !== undefined) {
            setAvatarUrl(resolveAvatarUrl(updated.avatar_url ?? null));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  return { isDriver, driverStatus, avatarUrl, fullName };
}
