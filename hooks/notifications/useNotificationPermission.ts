// React hook for notification permission management
// Professional permission handling following UX best practices

'use client';

import { useEffect, useState, useCallback } from 'react';
import { OneSignalClient } from '@/lib/notifications/onesignal-client';

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

  const client = OneSignalClient.getInstance();

  /**
   * Check current permission status
   */
  const checkPermission = useCallback(async () => {
    try {
      const currentPermission = await client.getPermission();
      setPermission(currentPermission);

      const subscribed = await client.isSubscribed();
      setIsSubscribed(subscribed);
    } catch (error) {
      console.error('Error checking permission:', error);
    }
  }, [client]);

  /**
   * Request notification permission from user
   * Best practice: Only call this in response to user action
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      const granted = await client.requestPermission();
      
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
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Check permission on mount
  useEffect(() => {
    if (client.isInitialized()) {
      checkPermission();
    }
  }, [client, checkPermission]);

  return {
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    checkPermission,
  };
}
