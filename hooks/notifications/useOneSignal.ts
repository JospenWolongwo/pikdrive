// React hook for OneSignal management
// Direct integration with OneSignal SDK following official patterns

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { NOTIFICATION_ACTIONS, NOTIFICATION_TYPE_ALIASES } from '@/types/notification';
import type { NotificationData, NotificationType } from '@/types/notification';

interface UseOneSignalReturn {
  readonly isInitialized: boolean;
  readonly error: Error | null;
  readonly setUserId: (userId: string) => Promise<void>;
  readonly removeUserId: () => Promise<void>;
  readonly getPermission: () => Promise<NotificationPermission>;
  readonly requestPermission: () => Promise<boolean>;
  readonly isSubscribed: () => Promise<boolean>;
}

/**
 * Hook for OneSignal management
 * Provides reactive state and helper functions for OneSignal operations
 * 
 * Note: OneSignal initialization is handled by OneSignalInitializer component
 * using the official deferred pattern. This hook only provides reactive state.
 */
export function useOneSignal(): UseOneSignalReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  // Monitor OneSignal initialization state and (re-)attach click listener when ready
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const checkInitialization = () => {
      if (window.OneSignal && window.__oneSignalReady) {
        setIsInitialized(true);
        setError(null);
      } else {
        setIsInitialized(false);
      }
    };

    checkInitialization();
    const interval = setInterval(checkInitialization, 1000);
    return () => clearInterval(interval);
  }, []);

  // Attach notification click listener only when OneSignal is ready (fixes cold start / late init)
  useEffect(() => {
    if (!window.OneSignal || !window.__oneSignalReady) return;

    const handleNotificationClick = (event: any) => {
      const data = (event?.notification?.data ?? event?.additionalData) as NotificationData | undefined;
      if (!data) return;

      const rawType = data.type ?? data.notificationType;
      const actionKey = (NOTIFICATION_TYPE_ALIASES[rawType as string] ?? rawType) as NotificationType;
      const getPath = NOTIFICATION_ACTIONS[actionKey];
      if (getPath) {
        const path = getPath(data);
        routerRef.current.push(path);
      }
    };

    const handleForegroundDisplay = (event: any) => {
      console.log('📬 Notification displayed:', event?.notification);
    };

    try {
      window.OneSignal.Notifications.addEventListener('click', handleNotificationClick);
      window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', handleForegroundDisplay);
      return () => {
        window.OneSignal?.Notifications.removeEventListener('click', handleNotificationClick);
        window.OneSignal?.Notifications.removeEventListener('foregroundWillDisplay', handleForegroundDisplay);
      };
    } catch (error) {
      console.error('❌ Failed to set up notification listeners:', error);
    }
  }, [isInitialized]);

  /**
   * Set external user ID (link with Supabase auth)
   */
  const setUserId = useCallback(async (userId: string) => {
    if (!window.OneSignal) {
      const error = new Error('OneSignal not initialized');
      setError(error);
      throw error;
    }

    try {
      await window.OneSignal.login(userId);
      console.log(`✅ User ID linked: ${userId}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to set user ID');
      setError(error);
      console.error('❌ Failed to set user ID:', error);
      throw error;
    }
  }, []);

  /**
   * Remove external user ID (on logout)
   */
  const removeUserId = useCallback(async () => {
    if (!window.OneSignal) {
      console.error('OneSignal not initialized for logout');
      return;
    }

    try {
      await window.OneSignal.logout();
      console.log('✅ User ID unlinked');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to remove user ID');
      setError(error);
      console.error('❌ Failed to remove user ID:', error);
    }
  }, []);

  /**
   * Check if user has granted notification permission
   */
  const getPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!window.OneSignal) {
      return 'default';
    }

    try {
      const permission = await window.OneSignal.Notifications.permission;
      return permission ? 'granted' : 'denied';
    } catch (error) {
      console.error('Error getting permission:', error);
      return 'default';
    }
  }, []);

  /**
   * Request notification permission from user
   * Uses native browser API to avoid "Permission blocked" errors
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!window.OneSignal) {
      console.error('OneSignal not initialized');
      return false;
    }

    try {
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
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      return false;
    }
  }, []);

  /**
   * Check if user is subscribed to notifications
   */
  const isSubscribed = useCallback(async (): Promise<boolean> => {
    if (!window.OneSignal) {
      return false;
    }

    try {
      const permission = await window.OneSignal.Notifications.permission;
      return permission === true;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  }, []);

  return {
    isInitialized,
    error,
    setUserId,
    removeUserId,
    getPermission,
    requestPermission,
    isSubscribed,
  };
}
