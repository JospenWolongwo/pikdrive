/**
 * Shared Supabase client instance to ensure consistency across the app
 */
import { createBrowserClient } from "@supabase/ssr";
import { ssrSupabaseConfig } from "./supabase-config";

export const supabaseClient = createBrowserClient(
  ssrSupabaseConfig.supabaseUrl,
  ssrSupabaseConfig.supabaseKey,
  {
    auth: ssrSupabaseConfig.auth,
    cookies: ssrSupabaseConfig.cookies,
  }
);
