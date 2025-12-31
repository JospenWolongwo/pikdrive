import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getVersionedStorageKey } from "@/lib/storage-version";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const currentSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const storedSupabaseUrl = cookieStore.get('supabase-project-url')?.value;
    const storageKey = getVersionedStorageKey("auth-storage");
    const hasAuthCookies = cookieStore.get(`${storageKey}-access-token`);

    // Create Supabase client to validate session
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
          storageKey: storageKey,
        },
      }
    );

    // Validate session - check if cookies are actually valid for current project
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const sessionValid = !!session && !sessionError;

    // Determine if we should clear cookies:
    // 1. Environment changed (URL mismatch)
    // 2. We have auth cookies but session is invalid (wrong project)
    const environmentChanged = storedSupabaseUrl && storedSupabaseUrl !== currentSupabaseUrl;
    const hasInvalidSession = hasAuthCookies && !sessionValid;

    let actuallyCleared = false;

    // If environment changed OR session is invalid, clear all auth cookies
    if (environmentChanged || hasInvalidSession) {
      console.log('🔄 Clearing cookies...', {
        reason: environmentChanged ? 'environment changed' : 'invalid session',
        stored: storedSupabaseUrl?.substring(0, 30),
        current: currentSupabaseUrl?.substring(0, 30),
        sessionValid,
        sessionError: sessionError?.message,
      });

      // Sign out from Supabase to properly clear auth state
      await supabase.auth.signOut();
      
      // Clear specific Supabase cookies by setting maxAge: 0 in response (as per guide)
      const authCookieNames = [
        `${storageKey}-access-token`,
        `${storageKey}-refresh-token`,
        'sb-access-token',
        'sb-refresh-token',
      ];

      authCookieNames.forEach(name => {
        cookieStore.delete(name);
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
          cookieStore.delete(cookie.name);
          clearedCount++;
        }
      });

      console.log(`✅ Cleared ${clearedCount} cookies`);
      actuallyCleared = true;
    }

    // Create response with cleared status
    const response = NextResponse.json({ 
      success: true, 
      cleared: actuallyCleared,
      reason: actuallyCleared 
        ? (environmentChanged ? 'environment changed' : 'invalid session')
        : 'no action needed',
    });

    // If we cleared cookies, also set them in response with maxAge: 0
    if (actuallyCleared) {
      const authCookieNames = [
        `${storageKey}-access-token`,
        `${storageKey}-refresh-token`,
        'sb-access-token',
        'sb-refresh-token',
      ];

      authCookieNames.forEach(name => {
        response.cookies.set(name, '', { maxAge: 0, path: '/' });
      });

      // Clear any other auth-related cookies in response
      const allCookies = cookieStore.getAll();
      allCookies.forEach(cookie => {
        if (
          cookie.name.includes('auth') ||
          cookie.name.includes('supabase') ||
          cookie.name.includes('sb-')
        ) {
          response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
        }
      });
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

