"use client";

import { useEffect, useState, useCallback } from "react";
import { pushNotificationService } from "@/lib/notifications/push-notification-service";
import { useOneSignal } from "@/hooks/notifications/useOneSignal";

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
        if (oneSignalInitialized && window.OneSignal) {
          console.log("🔧 Using OneSignal for push notifications");
          // Use native browser API to avoid "Permission blocked" errors
          if (!("Notification" in window)) {
            console.warn("This browser does not support notifications");
            return false;
          }

          // Check if Notification API is available (iOS Safari doesn't support it)
          if (typeof Notification === 'undefined' || !('Notification' in window)) {
            console.warn('⚠️ Notification API not supported on this device');
            return false;
          }

          // Check current permission (safely)
          let currentPermission: NotificationPermission;
          try {
            currentPermission = Notification.permission;
          } catch (error) {
            console.warn('Error accessing Notification.permission:', error);
            return false;
          }

          if (currentPermission === "granted") {
            console.log('✅ Notification permission already granted');
            return true;
          }

          if (currentPermission === "denied") {
            console.log('❌ Notification permission was previously denied');
            return false;
          }

          console.log('📱 Requesting notification permission via native API...');
          let permission: NotificationPermission;
          try {
            permission = await Notification.requestPermission();
          } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
          }
          const granted = permission === "granted";
          
          if (granted) {
            console.log('✅ Notification permission granted via native API');
            
            // Sync with OneSignal after native permission is granted
            try {
              await window.OneSignal.Notifications.requestPermission();
              console.log('✅ OneSignal permission sync successful');
            } catch (oneSignalError) {
              console.warn('⚠️ OneSignal sync failed but native permission granted:', oneSignalError);
            }
          } else {
            console.log('❌ Notification permission denied via native API');
          }

          return granted;
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
    [state.isRegistered, state.registration, oneSignalInitialized]
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
