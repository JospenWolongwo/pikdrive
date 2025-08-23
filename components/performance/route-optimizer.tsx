"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

interface RouteOptimizerProps {
  children: React.ReactNode;
}

export function RouteOptimizer({ children }: RouteOptimizerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const lastPathname = useRef<string>("");
  const preloadTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any pending preload
    if (preloadTimeout.current) {
      clearTimeout(preloadTimeout.current);
    }

    // Only optimize if we're actually changing routes
    if (pathname !== lastPathname.current) {
      lastPathname.current = pathname;

      // Preload common navigation routes after a short delay
      preloadTimeout.current = setTimeout(() => {
        // Preload critical routes
        const criticalRoutes = [
          "/driver/dashboard",
          "/profile",
          "/bookings",
          "/auth",
        ];

        criticalRoutes.forEach((route) => {
          if (route !== pathname) {
            // Prefetch the route
            router.prefetch(route);
          }
        });
      }, 100); // Small delay to avoid blocking current navigation
    }

    return () => {
      if (preloadTimeout.current) {
        clearTimeout(preloadTimeout.current);
      }
    };
  }, [pathname, router]);

  return <>{children}</>;
}
