"use client";

import { useEffect } from "react";

export function OfflineServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

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
