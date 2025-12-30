import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getVersionedStorageKey } from "@/lib/storage-version";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Skip middleware for static assets and API routes
  if (
    req.nextUrl.pathname.startsWith("/_next") ||
    req.nextUrl.pathname.startsWith("/api") ||
    req.nextUrl.pathname.startsWith("/static") ||
    req.nextUrl.pathname.includes(".")
  ) {
    return res;
  }

  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          const isProd = process.env.NODE_ENV === 'production';
          const merged = {
            name,
            value,
            path: '/',
            httpOnly: true,
            sameSite: 'lax' as const,
            secure: isProd,
            ...options,
          };
          res.cookies.set(merged);
        },
        remove(name: string, options: any) {
          const isProd = process.env.NODE_ENV === 'production';
          const merged = {
            name,
            value: "",
            path: '/',
            httpOnly: true,
            sameSite: 'lax' as const,
            secure: isProd,
            ...options,
          };
          res.cookies.set(merged);
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

  // Protected routes that require authentication
  const protectedPaths = [
    "/profile", // User profile settings
    "/bookings", // User's bookings (Mes réservations)
    "/driver/dashboard", // Driver's dashboard (Vos trajets)
    "/driver/rides", // Driver's rides
    "/payments", // Payment processing
    "/settings", // User settings
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );


  // Only check auth for protected paths to reduce unnecessary processing
  if (isProtectedPath) {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      // Check for session first
      if (session && session.user) {
        // Valid session found, allow access
        return res;
      }

      // Attempt to refresh session server-side before redirecting
      try {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session?.user) {
          // Session refreshed successfully, allow access and include updated cookies
          return res;
        }
      } catch (_) {
        // ignore and fall through to redirect
      }

      // No valid session found - redirect to auth
      // Note: We don't check any fallback storage - if there's no session, user needs to re-authenticate

      // No valid session or user data found, redirect to auth
      const redirectUrl = new URL("/auth", req.url);
      redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      // Forward cookies set on this response so auth tokens persist across redirects
      res.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    } catch (error) {
      // On error, redirect to auth
      const redirectUrl = new URL("/auth", req.url);
      redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      res.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
  }

  // Allow access to auth page for authentication
  if (req.nextUrl.pathname.startsWith("/auth")) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // If user has a valid session, redirect away from auth page
      if (session && session.user) {
        const redirectTo = req.nextUrl.searchParams.get("redirectTo") || "/";
        const redirectResponse = NextResponse.redirect(new URL(redirectTo, req.url));
        res.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie);
        });
        return redirectResponse;
      }

      // Attempt a server-side refresh so returning users don't get stuck
      try {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.user) {
          const redirectTo = req.nextUrl.searchParams.get("redirectTo") || "/";
          const redirectResponse = NextResponse.redirect(new URL(redirectTo, req.url));
          res.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie);
          });
          return redirectResponse;
        }
      } catch (_) {
        // ignore; allow access to auth page
      }

      // If no session, allow access to auth page
      // If no session or invalid session, allow access to auth page
    } catch (error) {
      // On error, allow access to auth page
    }
  }

  return res;
}

// Ensure the middleware is only called for relevant paths
export const config = {
  matcher: [
    "/profile/:path*",
    "/bookings/:path*",
    "/driver/:path*",
    "/payments/:path*",
    "/settings/:path*",
    "/auth/:path*",
  ],
};
