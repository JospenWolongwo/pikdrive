import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  whatsapp_notifications: boolean;
  language: string;
  phone_number: string;
  timezone: string;
  theme: string;
}

type Result<T> = { success: true; data: T } | { success: false; error: Error };

const DEFAULT_SETTINGS: UserSettings = {
  email_notifications: true,
  sms_notifications: true,
  whatsapp_notifications: true,
  language: "fr",
  phone_number: "",
  timezone: "Africa/Douala",
  theme: "system",
};

export async function fetchUserSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<Result<UserSettings>> {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      return { success: false, error: new Error(error.message) };
    }

    if (!data) {
      return { success: true, data: { ...DEFAULT_SETTINGS } };
    }

    const settings: UserSettings = {
      ...DEFAULT_SETTINGS,
      ...data,
      email_notifications: data.email_notifications ?? DEFAULT_SETTINGS.email_notifications,
      sms_notifications: data.sms_notifications ?? DEFAULT_SETTINGS.sms_notifications,
      whatsapp_notifications:
        data.whatsapp_notifications ?? DEFAULT_SETTINGS.whatsapp_notifications,
      language: data.language ?? DEFAULT_SETTINGS.language,
      phone_number: data.phone_number ?? DEFAULT_SETTINGS.phone_number,
      timezone: data.timezone ?? DEFAULT_SETTINGS.timezone,
      theme: data.theme ?? DEFAULT_SETTINGS.theme,
    };
    return { success: true, data: settings };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error("Failed to load settings"),
    };
  }
}

export async function saveUserSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: UserSettings
): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("user_settings").upsert({
      user_id: userId,
      ...settings,
    });

    if (error) {
      return { success: false, error: new Error(error.message) };
    }
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error("Failed to save settings"),
    };
  }
}
