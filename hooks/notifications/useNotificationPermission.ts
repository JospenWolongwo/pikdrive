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
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      // Check if OneSignal is ready before requesting permission
      if (!window.OneSignal || !window.__oneSignalReady) {
        console.log('⏳ OneSignal not ready yet, permission request will fail');
        setPermission('denied');
        setIsSubscribed(false);
        return false;
      }

      const granted = await window.OneSignal!.Notifications.requestPermission();
      
      if (granted) {
        setPermission('granted');
        setIsSubscribed(true);
        console.log('✅ Notification permission granted');
      } else {
        setPermission('denied');
        setIsSubscribed(false);
        console.log('❌ Notification permission denied');
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
