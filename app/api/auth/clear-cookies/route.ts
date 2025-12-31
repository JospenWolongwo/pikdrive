import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getVersionedStorageKey } from "@/lib/storage-version";

// Helper to decode JWT without verification (just to check issuer)
function getJwtIssuer(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.iss || null;
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const currentSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const storedSupabaseUrl = cookieStore.get('supabase-project-url')?.value;
    const storageKey = getVersionedStorageKey("auth-storage");
    const accessTokenCookie = cookieStore.get(`${storageKey}-access-token`);
    const hasAuthCookies = !!accessTokenCookie;

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

    // CRITICAL: Also check if the token's issuer matches current project
    // Extract project ref from URL (e.g., https://xxx.supabase.co -> xxx)
    const currentProjectRef = currentSupabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    let tokenIssuerMismatch = false;
    let accessToken: string | null = null;
    
    // Try to extract access token from cookie
    if (accessTokenCookie?.value) {
      try {
        // The cookie might be a JSON object with access_token, or just the token itself
        const cookieValue = accessTokenCookie.value;
        if (cookieValue.startsWith('{')) {
          const parsed = JSON.parse(cookieValue);
          accessToken = parsed.access_token || parsed.token || null;
        } else {
          accessToken = cookieValue;
        }
      } catch {
        // If parsing fails, treat the whole value as the token
        accessToken = accessTokenCookie.value;
      }
    }
    
    // Check if token issuer matches current project
    if (accessToken && currentProjectRef) {
      const tokenIssuer = getJwtIssuer(accessToken);
      // JWT issuer format: https://xxx.supabase.co/auth/v1
      const issuerProjectRef = tokenIssuer?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      tokenIssuerMismatch = !!(issuerProjectRef && issuerProjectRef !== currentProjectRef);
    }

    // Determine if we should clear cookies:
    // 1. Environment changed (URL mismatch)
    // 2. We have auth cookies but session is invalid (wrong project)
    // 3. Token issuer doesn't match current project (CRITICAL FIX)
    const environmentChanged = storedSupabaseUrl && storedSupabaseUrl !== currentSupabaseUrl;
    const hasInvalidSession = hasAuthCookies && !sessionValid;
    const tokenFromWrongProject = tokenIssuerMismatch;

    let actuallyCleared = false;

    // If any condition is true, clear all auth cookies
    if (environmentChanged || hasInvalidSession || tokenFromWrongProject) {
      console.log('🔄 Clearing cookies...', {
        reason: environmentChanged ? 'environment changed' 
          : tokenFromWrongProject ? 'token from wrong project'
          : 'invalid session',
        stored: storedSupabaseUrl?.substring(0, 30),
        current: currentSupabaseUrl?.substring(0, 30),
        sessionValid,
        tokenFromWrongProject,
        currentProjectRef,
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
        ? (environmentChanged ? 'environment changed' 
          : tokenFromWrongProject ? 'token from wrong project'
          : 'invalid session')
        : 'no action needed',
      debug: {
        environmentChanged,
        hasInvalidSession,
        tokenFromWrongProject,
        sessionValid,
      },
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

