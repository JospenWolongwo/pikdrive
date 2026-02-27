"use client";

import { useEffect } from "react";

export function OfflineServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isProduction = process.env.NODE_ENV === "production";

    if (!isProduction) {
      const cleanupDevServiceWorkers = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map(async (registration) => {
              const scriptUrl = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || "";
              if (scriptUrl.includes("/sw.js")) {
                await registration.unregister();
              }
            })
          );

          if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames
                .filter((name) => name.startsWith("pickdrive-"))
                .map((name) => caches.delete(name))
            );
          }
        } catch {
          // Silently fail in development cleanup
        }
      };

      void cleanupDevServiceWorkers();
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch {
        // Silently fail - offline support is optional
      }
    };

    void register();
  }, []);

  return null;
}
