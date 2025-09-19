import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
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

  const supabase = createMiddlewareClient({ req, res });

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
      } = await supabase.auth.getSession();

      if (!session) {
        const redirectUrl = new URL("/auth", req.url);
        redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error) {
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
