import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase-config";

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
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          res.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "auth-storage",
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

      // If no session, check if there's an auth-storage cookie with user data
      // This handles the race condition where user just logged in but session isn't established yet
      const authStorageCookie = req.cookies.get("auth-storage");
      if (authStorageCookie?.value) {
        try {
          const authData = JSON.parse(authStorageCookie.value);
          const userData = authData?.state?.user;
          
          // If we have valid user data in the cookie, allow access
          // The client-side auth provider will handle session establishment
          if (userData && userData.id && userData.aud === "authenticated") {
            return res;
          }
        } catch (parseError) {
          // If we can't parse the auth storage, continue to redirect
          console.warn("Failed to parse auth-storage cookie:", parseError);
        }
      }

      // No valid session or user data found, redirect to auth
      const redirectUrl = new URL("/auth", req.url);
      redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    } catch (error) {
      // On error, still try to check auth-storage cookie as fallback
      const authStorageCookie = req.cookies.get("auth-storage");
      if (authStorageCookie?.value) {
        try {
          const authData = JSON.parse(authStorageCookie.value);
          const userData = authData?.state?.user;
          
          if (userData && userData.id && userData.aud === "authenticated") {
            return res;
          }
        } catch (parseError) {
          // Continue to redirect
        }
      }
      
      const redirectUrl = new URL("/auth", req.url);
      redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
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
        return NextResponse.redirect(new URL(redirectTo, req.url));
      }

      // Also check auth-storage cookie for authenticated users
      const authStorageCookie = req.cookies.get("auth-storage");
      if (authStorageCookie?.value) {
        try {
          const authData = JSON.parse(authStorageCookie.value);
          const userData = authData?.state?.user;
          
          if (userData && userData.id && userData.aud === "authenticated") {
            const redirectTo = req.nextUrl.searchParams.get("redirectTo") || "/";
            return NextResponse.redirect(new URL(redirectTo, req.url));
          }
        } catch (parseError) {
          // Continue to allow access to auth page
        }
      }
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
