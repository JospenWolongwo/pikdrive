// React hook for OneSignal initialization
// Professional, clean integration following React best practices

'use client';

import { useEffect, useState, useCallback } from 'react';
import { OneSignalClient } from '@/lib/notifications/onesignal-client';
import { useRouter } from 'next/navigation';
import { NOTIFICATION_ACTIONS } from '@/types/notification';
import type { NotificationData, NotificationType } from '@/types/notification';

interface UseOneSignalReturn {
  readonly isInitialized: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly initialize: () => Promise<void>;
  readonly setUserId: (userId: string) => Promise<void>;
  readonly removeUserId: () => Promise<void>;
}

/**
 * Hook for OneSignal initialization and management
 * 
 * @example
 * ```tsx
 * const { initialize, isInitialized } = useOneSignal();
 * 
 * useEffect(() => {
 *   initialize();
 * }, []);
 * ```
 */
export function useOneSignal(): UseOneSignalReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  const client = OneSignalClient.getInstance();

  /**
   * Initialize OneSignal SDK
   */
  const initialize = useCallback(async () => {
    if (client.isInitialized()) {
      setIsInitialized(true);
      return;
    }

    console.log('🔍 Checking OneSignal App ID:', process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID);
    
    if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) {
      const error = new Error('OneSignal App ID not configured');
      setError(error);
      console.error('❌ Missing NEXT_PUBLIC_ONESIGNAL_APP_ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await client.initialize(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID);
      
      // Set up notification click handler
      client.onNotificationClick((event) => {
        const data = event.notification.data as NotificationData;
        const type = data.type;
        
        if (type && NOTIFICATION_ACTIONS[type as NotificationType]) {
          const action = NOTIFICATION_ACTIONS[type as NotificationType](data);
          router.push(action);
        }
      });

      // Set up foreground notification handler
      client.onNotificationDisplayed((event) => {
        console.log('📬 Notification displayed:', event.notification);
        // You can add custom sound/UI handling here
      });

      setIsInitialized(true);
      console.log('✅ OneSignal hook initialized');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize OneSignal');
      setError(error);
      console.error('❌ OneSignal initialization failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [client, router]);

  /**
   * Set external user ID (link with Supabase auth)
   */
  const setUserId = useCallback(async (userId: string) => {
    try {
      await client.setExternalUserId(userId);
      console.log(`✅ User ID linked: ${userId}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to set user ID');
      setError(error);
      console.error('❌ Failed to set user ID:', error);
      throw error;
    }
  }, [client]);

  /**
   * Remove external user ID (on logout)
   */
  const removeUserId = useCallback(async () => {
    try {
      await client.removeExternalUserId();
      console.log('✅ User ID unlinked');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to remove user ID');
      setError(error);
      console.error('❌ Failed to remove user ID:', error);
    }
  }, [client]);

  return {
    isInitialized,
    isLoading,
    error,
    initialize,
    setUserId,
    removeUserId,
  };
}
