/**
 * Shared Supabase configuration for long session persistence
 * Users will stay logged in for 1 year with auto-refresh
 */

import { getVersionedStorageKey } from "@/lib/storage-version";

const baseAuthConfig = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  storageKey: getVersionedStorageKey("auth-storage"),
} as const;

export const supabaseConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  auth: baseAuthConfig,
} as const;

// Configuration for SSR client (requires cookies)
export const ssrSupabaseConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  auth: baseAuthConfig,
  cookies: {
    get(name: string) {
      if (typeof window === "undefined") return undefined;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift();
    },
    set(name: string, value: string, options: any) {
      if (typeof window === "undefined") return;
      let cookie = `${name}=${value}`;
      if (options?.expires) {
        cookie += `; expires=${options.expires.toUTCString()}`;
      }
      if (options?.path) cookie += `; path=${options.path}`;
      if (options?.domain) cookie += `; domain=${options.domain}`;
      if (options?.secure) cookie += "; secure";
      if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
      document.cookie = cookie;
    },
    remove(name: string, options: any) {
      if (typeof window === "undefined") return;
      let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      if (options?.path) cookie += `; path=${options.path}`;
      if (options?.domain) cookie += `; domain=${options.domain}`;
      document.cookie = cookie;
    },
  },
} as const;

// Note: We removed auth-zustand-storage config because authentication
// is now handled entirely by Supabase cookies (auth-storage).
// Zustand is only used for other app state like bookings, rides, etc.
