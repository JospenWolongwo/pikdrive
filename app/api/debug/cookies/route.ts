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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('auth') ||
      cookie.name.includes('supabase') ||
      cookie.name.includes('sb-')
    );

    // Validate session to check if cookies are actually valid
    let sessionValid = false;
    let sessionError = null;
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
          auth: {
            storageKey: getVersionedStorageKey("auth-storage"),
          },
        }
      );
      
      const { data: { session }, error } = await supabase.auth.getSession();
      sessionValid = !!session && !error;
      sessionError = error?.message || null;
    } catch (e) {
      sessionError = e instanceof Error ? e.message : 'Unknown error';
    }

    // Check token issuer - check all possible cookie name variations
    const storageKey = getVersionedStorageKey("auth-storage");
    const accessTokenCookie = cookieStore.get(`${storageKey}-access-token`) 
      || cookieStore.get("auth-storage-access-token")
      || cookieStore.get(storageKey)
      || cookieStore.get("auth-storage");
    const currentProjectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    let tokenIssuerMismatch = false;
    let tokenIssuer = null;
    let tokenProjectRef = null;
    
    if (accessTokenCookie?.value && currentProjectRef) {
      let accessToken: string | null = null;
      try {
        const cookieValue = accessTokenCookie.value;
        if (cookieValue.startsWith('{')) {
          // It's a JSON object - parse it
          const parsed = JSON.parse(cookieValue);
          accessToken = parsed.access_token || parsed.token || null;
        } else {
          // It's the token directly
          accessToken = cookieValue;
        }
      } catch {
        accessToken = accessTokenCookie.value;
      }
      
      // Also search all cookies if we didn't find a token yet
      if (!accessToken) {
        for (const cookie of allCookies) {
          if (cookie.name.includes('auth') || cookie.name.includes('supabase')) {
            try {
              const value = cookie.value;
              if (value.startsWith('{')) {
                const parsed = JSON.parse(value);
                if (parsed.access_token) {
                  accessToken = parsed.access_token;
                  break;
                }
              } else if (value.startsWith('eyJ')) {
                // Looks like a JWT token
                accessToken = value;
                break;
              }
            } catch {
              // Continue searching
            }
          }
        }
      }
      
      if (accessToken) {
        tokenIssuer = getJwtIssuer(accessToken);
        tokenProjectRef = tokenIssuer?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
        tokenIssuerMismatch = !!(tokenProjectRef && tokenProjectRef !== currentProjectRef);
      }
    }

    return NextResponse.json({
      totalCookies: allCookies.length,
      authCookies: authCookies.map(c => ({
        name: c.name,
        hasValue: !!c.value,
        valueLength: c.value?.length || 0,
        valuePreview: c.value ? `${c.value.substring(0, 20)}...` : 'empty',
      })),
      currentSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40),
      storedSupabaseUrl: cookieStore.get('supabase-project-url')?.value?.substring(0, 40),
      environmentMatch: process.env.NEXT_PUBLIC_SUPABASE_URL === cookieStore.get('supabase-project-url')?.value,
      sessionValid,
      sessionError,
      tokenIssuerMismatch,
      currentProjectRef,
      tokenProjectRef,
      needsClearing: (!sessionValid && authCookies.length > 0) || tokenIssuerMismatch,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

