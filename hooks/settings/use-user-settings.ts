"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useLocale } from "../useLocale";
import {
  type UserSettings,
  fetchUserSettings,
  saveUserSettings,
} from "@/lib/services/client/settings";

export function useUserSettings() {
  const { supabase, user } = useSupabase();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({
    email_notifications: true,
    sms_notifications: true,
    whatsapp_notifications: true,
    language: "fr",
    phone_number: "",
    timezone: "Africa/Douala",
    theme: "system",
  });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const result = await fetchUserSettings(supabase, user.id);
      if (result.success && result.data) {
        setSettings(result.data);
      }
      setLoading(false);
    };

    load();
  }, [user, supabase]);

  const saveSettings = async () => {
    if (!user) return;

    const result = await saveUserSettings(supabase, user.id, settings);
    if (result.success) {
      toast.success(t("pages.settings.toast.saved"));
    } else {
      toast.error(t("pages.settings.toast.error"));
    }
  };

  return { settings, setSettings, loading, saveSettings };
}
