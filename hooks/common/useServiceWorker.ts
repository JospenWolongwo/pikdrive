"use client";

import { useEffect, useState, useCallback } from "react";
import { pushNotificationService } from "@/lib/notifications/push-notification-service";
import { useOneSignal } from "@/hooks/notifications/useOneSignal";
import { OneSignalClient } from "@/lib/notifications/onesignal-client";

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
  const { isInitialized: oneSignalInitialized } = useOneSignal();

  // Check if service worker is supported
  useEffect(() => {
    const isSupported = "serviceWorker" in navigator;
    setState((prev) => ({ ...prev, isSupported }));
  }, []);

  // Check for existing service worker (OneSignal's)
  const checkServiceWorker = useCallback(async () => {
    if (!state.isSupported) {
      console.warn("Service Worker not supported");
      return false;
    }

    try {
      console.log("🔧 Checking for OneSignal Service Worker...");
      
      // Get existing service worker registration (OneSignal should have registered it)
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        console.log("✅ OneSignal Service Worker found:", registration);
        
        setState((prev) => ({
          ...prev,
          isRegistered: true,
          isInstalled: true,
          registration,
        }));
        
        return true;
      } else {
        console.log("⚠️ No service worker found - OneSignal may not be initialized yet");
        return false;
      }
    } catch (error) {
      console.error("Failed to check service worker:", error);
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
        oneSignalInitialized,
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

        // Use OneSignal if available, otherwise fall back to custom push service
        if (oneSignalInitialized) {
          console.log("🔧 Using OneSignal for push notifications");
          const oneSignalClient = OneSignalClient.getInstance();
          const permission = await oneSignalClient.requestPermission();
          console.log("🔧 OneSignal permission result:", permission);
          return permission;
        } else {
          console.log("🔧 OneSignal not initialized, using custom push service...");
          const subscription = await pushNotificationService.subscribeToPush(
            userId
          );
          console.log("🔧 Subscription result:", subscription);
          return !!subscription;
        }
      } catch (error) {
        console.error("Failed to subscribe to push notifications:", error);
        return false;
      }
    },
    [state.isRegistered, state.registration, oneSignalInitialized, oneSignalRequestPermission]
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

  // Check for OneSignal service worker
  useEffect(() => {
    if (state.isSupported && !state.isRegistered) {
      checkServiceWorker();
    }
  }, [state.isSupported, state.isRegistered, checkServiceWorker]);

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
    checkServiceWorker,
    installUpdate,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
  };
}
