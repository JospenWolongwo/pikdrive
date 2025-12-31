import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getVersionedStorageKey } from "@/lib/storage-version";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const currentSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const storedSupabaseUrl = cookieStore.get('supabase-project-url')?.value;

    const response = NextResponse.json({ success: true, cleared: true });

    // If environment changed, clear all auth cookies
    if (storedSupabaseUrl && storedSupabaseUrl !== currentSupabaseUrl) {
      console.log('🔄 Environment changed, clearing cookies...', {
        stored: storedSupabaseUrl.substring(0, 30),
        current: currentSupabaseUrl?.substring(0, 30),
      });

      // Create Supabase client to use signOut
      const supabase = createServerClient(
        currentSupabaseUrl!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              cookieStore.set({ name, value, ...options });
            },
            remove(name: string, options: any) {
              cookieStore.set({ name, value: "", ...options });
            },
          },
          auth: {
            storageKey: getVersionedStorageKey("auth-storage"),
          },
        }
      );

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Get storage key for cookie names
      const storageKey = getVersionedStorageKey("auth-storage");
      
      // Clear specific Supabase cookies by setting maxAge: 0 in response (as per guide)
      const authCookieNames = [
        `${storageKey}-access-token`,
        `${storageKey}-refresh-token`,
        'sb-access-token',
        'sb-refresh-token',
      ];

      authCookieNames.forEach(name => {
        response.cookies.set(name, '', { maxAge: 0, path: '/' });
      });

      // Also clear any other auth-related cookies
      const allCookies = cookieStore.getAll();
      let clearedCount = 0;
      allCookies.forEach(cookie => {
        if (
          cookie.name.includes('auth') ||
          cookie.name.includes('supabase') ||
          cookie.name.includes('sb-')
        ) {
          response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
          clearedCount++;
        }
      });

      console.log(`✅ Cleared ${clearedCount} cookies`);
    }

    // Store current environment
    if (currentSupabaseUrl) {
      cookieStore.set('supabase-project-url', currentSupabaseUrl, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
      });
      response.cookies.set('supabase-project-url', currentSupabaseUrl, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return response;
  } catch (error) {
    console.error('❌ Error clearing cookies:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

