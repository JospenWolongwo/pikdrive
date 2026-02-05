"use client";

import { useEffect, useState, useCallback } from "react";
import { useOneSignal } from "@/hooks/notifications";

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
      return false;
    }

    try {
      // Get existing service worker registration (OneSignal should have registered it)
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        setState((prev) => ({
          ...prev,
          isRegistered: true,
          isInstalled: true,
          registration,
        }));
        
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }, [state.isSupported]);

  // Install service worker update
  const installUpdate = useCallback(async () => {
    if (!state.registration) return;

    try {
      // Send message to service worker to skip waiting
      if (state.registration.waiting) {
        state.registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      setUpdateAvailable(false);
    } catch (error) {
      // Silently fail - update installation error
    }
  }, [state.registration]);

  // Subscribe to push notifications
  const subscribeToPushNotifications = useCallback(
    async (userId: string) => {
      if (!state.isRegistered || !state.registration) {
        return false;
      }

      try {
        // Use OneSignal if available, otherwise fall back to custom push service
        if (oneSignalInitialized && window.OneSignal) {
          // Use native browser API to avoid "Permission blocked" errors
          if (!("Notification" in window)) {
            return false;
          }

          // Check if Notification API is available (iOS Safari doesn't support it)
          if (typeof Notification === 'undefined' || !('Notification' in window)) {
            return false;
          }

          // Check current permission (safely)
          let currentPermission: NotificationPermission;
          try {
            currentPermission = Notification.permission;
          } catch (error) {
            return false;
          }

          if (currentPermission === "granted") {
            return true;
          }

          if (currentPermission === "denied") {
            return false;
          }

          let permission: NotificationPermission;
          try {
            permission = await Notification.requestPermission();
          } catch (error) {
            return false;
          }
          const granted = permission === "granted";
          
          if (granted) {
            // Sync with OneSignal after native permission is granted
            try {
              await window.OneSignal.Notifications.requestPermission();
            } catch (oneSignalError) {
              // Silently fail - native permission already granted
            }
          }

          return granted;
        } else {
          return false;
        }
      } catch (error) {
        return false;
      }
    },
    [state.isRegistered, state.registration, oneSignalInitialized]
  );

  // Unsubscribe from push notifications
  const unsubscribeFromPushNotifications = useCallback(
    async (userId: string) => {
      // Note: OneSignal handles push subscription management
      // This function is kept for API compatibility but OneSignal manages subscriptions
      return true;
    },
    []
  );

  // Check for OneSignal service worker periodically
  useEffect(() => {
    if (state.isSupported) {
      // Check immediately
      checkServiceWorker();
      
      // Check every 5 seconds until service worker is found
      const interval = setInterval(() => {
        if (!state.isRegistered) {
          checkServiceWorker();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [state.isSupported, state.isRegistered, checkServiceWorker]);

  // Listen for service worker messages
  useEffect(() => {
    if (!state.registration) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_OFFLINE_TRANSACTIONS") {
        // Handle offline transaction sync
      } else if (event.data?.type === "SYNC_OFFLINE_MESSAGES") {
        // Handle offline message sync
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
