"use client";

import { useEffect, useState, useCallback } from "react";
import { pushNotificationService } from "@/lib/notifications/push-notification-service";

interface ServiceWorkerState {
  readonly isSupported: boolean;
  readonly isRegistered: boolean;
  readonly isInstalled: boolean;
  readonly isUpdating: boolean;
  readonly registration: ServiceWorkerRegistration | null;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isInstalled: false,
    isUpdating: false,
    registration: null,
  });

  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Check if service worker is supported
  useEffect(() => {
    const isSupported = "serviceWorker" in navigator;
    setState((prev) => ({ ...prev, isSupported }));
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!state.isSupported) {
      console.warn("Service Worker not supported");
      return false;
    }

    try {
      console.log("🔧 Registering PikDrive Service Worker...");

      // Register the custom service worker
      const registration = await navigator.serviceWorker.register(
        "/sw-custom.js",
        {
          scope: "/",
        }
      );

      console.log("✅ Service Worker registered successfully:", registration);

      // Check if there's an update available
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          setState((prev) => ({ ...prev, isUpdating: true }));

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateAvailable(true);
              setState((prev) => ({ ...prev, isUpdating: false }));
              console.log("🔄 Service Worker update available");
            }
          });
        }
      });

      // Handle service worker updates
      registration.addEventListener("controllerchange", () => {
        console.log("🔄 Service Worker controller changed");
        window.location.reload();
      });

      setState((prev) => ({
        ...prev,
        isRegistered: true,
        registration,
      }));

      return true;
    } catch (error) {
      console.error("Failed to register Service Worker:", error);
      return false;
    }
  }, [state.isSupported]);

  // Install service worker update
  const installUpdate = useCallback(async () => {
    if (!state.registration) return;

    try {
      console.log("🔄 Installing Service Worker update...");

      // Send message to service worker to skip waiting
      if (state.registration.waiting) {
        state.registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      setUpdateAvailable(false);
    } catch (error) {
      console.error("Failed to install update:", error);
    }
  }, [state.registration]);

  // Subscribe to push notifications
  const subscribeToPushNotifications = useCallback(
    async (userId: string) => {
      console.log("🔧 Service Worker state:", {
        isRegistered: state.isRegistered,
        hasRegistration: !!state.registration,
        userId,
      });

      if (!state.isRegistered || !state.registration) {
        console.warn("Service Worker not registered");
        return false;
      }

      try {
        console.log(
          "🔧 Service worker registration status:",
          state.registration.active ? "active" : "installing"
        );
        // Service worker should already be ready if registered
        console.log("🔧 Service worker is ready");

        // Subscribe to push notifications
        console.log("🔧 Calling pushNotificationService.subscribeToPush...");
        const subscription = await pushNotificationService.subscribeToPush(
          userId
        );
        console.log("🔧 Subscription result:", subscription);
        return !!subscription;
      } catch (error) {
        console.error("Failed to subscribe to push notifications:", error);
        return false;
      }
    },
    [state.isRegistered, state.registration]
  );

  // Unsubscribe from push notifications
  const unsubscribeFromPushNotifications = useCallback(
    async (userId: string) => {
      try {
        const success = await pushNotificationService.unsubscribeFromPush();
        // Note: We'll handle database cleanup via API route if needed
        return success;
      } catch (error) {
        console.error("Failed to unsubscribe from push notifications:", error);
        return false;
      }
    },
    []
  );

  // Initialize service worker
  useEffect(() => {
    if (state.isSupported && !state.isRegistered) {
      registerServiceWorker();
    }
  }, [state.isSupported, state.isRegistered, registerServiceWorker]);

  // Listen for service worker messages
  useEffect(() => {
    if (!state.registration) return;

    const handleMessage = (event: MessageEvent) => {
      console.log("📨 Main thread received message:", event.data);

      if (event.data?.type === "SYNC_OFFLINE_TRANSACTIONS") {
        // Handle offline transaction sync
        console.log("💾 Syncing offline transactions...");
      } else if (event.data?.type === "SYNC_OFFLINE_MESSAGES") {
        // Handle offline message sync
        console.log("💬 Syncing offline messages...");
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [state.registration]);

  return {
    ...state,
    updateAvailable,
    registerServiceWorker,
    installUpdate,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
  };
}
