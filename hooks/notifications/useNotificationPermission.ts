// React hook for notification permission management
// Professional permission handling following UX best practices

'use client';

import { useEffect, useState, useCallback } from 'react';

interface UseNotificationPermissionReturn {
  readonly permission: NotificationPermission;
  readonly isSubscribed: boolean;
  readonly isLoading: boolean;
  readonly requestPermission: () => Promise<boolean>;
  readonly checkPermission: () => Promise<void>;
}

/**
 * Hook for managing notification permissions
 * 
 * @example
 * ```tsx
 * const { permission, isSubscribed, requestPermission } = useNotificationPermission();
 * 
 * if (!isSubscribed) {
 *   return (
 *     <button onClick={requestPermission}>
 *       Enable Notifications
 *     </button>
 *   );
 * }
 * ```
 */
export function useNotificationPermission(): UseNotificationPermissionReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check current permission status
   */
  const checkPermission = useCallback(async () => {
    if (!window.OneSignal) {
      return;
    }

    try {
      const currentPermission = await window.OneSignal.Notifications.permission;
      setPermission(currentPermission ? 'granted' : 'denied');

      const subscribed = currentPermission === true;
      setIsSubscribed(subscribed);
    } catch (error) {
      console.error('Error checking permission:', error);
    }
  }, []);

  /**
   * Request notification permission from user
   * Best practice: Only call this in response to user action
   * Uses native browser API to avoid "Permission blocked" errors
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      // CRITICAL: Use native browser API FIRST to avoid "Permission blocked"
      // Don't wait for OneSignal to be ready - we can request permission independently
      if (!("Notification" in window)) {
        console.warn("This browser does not support notifications");
        setPermission('denied');
        setIsSubscribed(false);
        return false;
      }

      // Check current permission
      if (Notification.permission === "granted") {
        setPermission('granted');
        setIsSubscribed(true);
        console.log('✅ Notification permission already granted');
        return true;
      }

      if (Notification.permission === "denied") {
        setPermission('denied');
        setIsSubscribed(false);
        console.log('❌ Notification permission was previously denied');
        return false;
      }

      // Request permission using native API (this will show browser popup)
      console.log('🔔 Requesting notification permission via native API...');
      const permission = await Notification.requestPermission();
      const granted = permission === "granted";
      
      if (granted) {
        setPermission('granted');
        setIsSubscribed(true);
        console.log('✅ Notification permission granted via native API');
        
        // Sync with OneSignal after native permission is granted (if OneSignal is available)
        if (window.OneSignal && window.__oneSignalReady) {
          try {
            console.log('🔄 Syncing permission with OneSignal...');
            await window.OneSignal.Notifications.requestPermission();
            console.log('✅ OneSignal permission sync successful');
          } catch (oneSignalError) {
            console.warn('⚠️ OneSignal sync failed but native permission granted:', oneSignalError);
            // Native permission still works even if OneSignal sync fails
          }
        } else {
          console.log('ℹ️ OneSignal not ready yet, but native permission granted');
        }
      } else {
        setPermission('denied');
        setIsSubscribed(false);
        console.log('❌ Notification permission denied via native API');
      }

      return granted;
    } catch (error) {
      console.error('Error requesting permission:', error);
      setPermission('denied');
      setIsSubscribed(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check permission on mount (only in browser)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.OneSignal && window.__oneSignalReady) {
      checkPermission();
    }
  }, [checkPermission]);

  return {
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    checkPermission,
  };
}
