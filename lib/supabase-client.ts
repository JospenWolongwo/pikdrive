/**
 * Shared Supabase client instance to ensure consistency across the app
 * Uses COOKIES ONLY for authentication - no localStorage
 */
import { createBrowserClient } from "@supabase/ssr";
import { getVersionedStorageKey } from "@/lib/storage-version";

// Cookie helper functions
const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
  return null;
};

const setCookie = (name: string, value: string, options?: any): void => {
  if (typeof document === "undefined") return;
  
  // Calculate expiration date
  let expires: Date;
  if (options?.maxAge) {
    // Convert maxAge (seconds) to expires (date)
    expires = new Date();
    expires.setTime(expires.getTime() + options.maxAge * 1000);
  } else if (options?.expires) {
    // Use provided expires date if available
    expires = options.expires instanceof Date ? options.expires : new Date(options.expires);
  } else {
    // Default to 1 year expiration (matching server-side: 60 * 60 * 24 * 365 seconds)
    expires = new Date();
    expires.setTime(expires.getTime() + 60 * 60 * 24 * 365 * 1000);
  }
  
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  const sameSite = options?.sameSite || 'Lax';
  const path = options?.path || '/';
  
  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=${path}; SameSite=${sameSite}${isSecure ? "; Secure" : ""}`;
};

const deleteCookie = (name: string): void => {
  if (typeof document === "undefined") return;
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${isSecure ? "; Secure" : ""}`;
};

export const supabaseClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get(name: string) {
        return getCookie(name);
      },
      set(name: string, value: string, options: any) {
        setCookie(name, value, options);
      },
      remove(name: string, options: any) {
        deleteCookie(name);
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: getVersionedStorageKey("auth-storage"),
    },
  }
);
