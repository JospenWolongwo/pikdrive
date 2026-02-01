// React hook for notification permission management
// Professional permission handling following UX best practices

'use client';

import { useEffect, useState, useCallback } from 'react';

interface UseNotificationPermissionReturn {
  readonly permission: NotificationPermission | 'unsupported';
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
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check current permission status
   * Uses native Notification.permission as source of truth, then syncs with OneSignal
   */
  const checkPermission = useCallback(async () => {
    // STEP 1: Check native permission first (immediate, synchronous, reliable)
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && 'permission' in Notification) {
      try {
        const nativePermission = Notification.permission;
        setPermission(nativePermission);
        
        // If native permission is granted, user is considered subscribed
        // This prevents showing prompt to users who already granted permission
        if (nativePermission === 'granted') {
          setIsSubscribed(true);
        } else if (nativePermission === 'denied') {
          setIsSubscribed(false);
        }
        // For 'default', keep current isSubscribed state until OneSignal confirms
      } catch (error) {
        console.warn('Error checking native Notification.permission:', error);
      }
    }

    // STEP 2: Sync with OneSignal if available (for accurate subscription state)
    if (window.OneSignal && window.__oneSignalReady) {
      try {
        const currentPermission = await window.OneSignal.Notifications.permission;
        const subscribed = currentPermission === true;
        setIsSubscribed(subscribed);
        
        // Update permission state based on OneSignal's perspective
        if (subscribed) {
          setPermission('granted');
        }
      } catch (error) {
        console.error('Error checking OneSignal permission:', error);
        // Don't reset states on error - keep native permission state
      }
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

      // Check if Notification API is available (iOS Safari doesn't support it)
      if (typeof Notification === 'undefined' || !('Notification' in window)) {
        console.warn('⚠️ Notification API not supported on this device');
        setPermission('unsupported');
        setIsSubscribed(false);
        return false;
      }

      // Check current permission (safely)
      let currentPermission: NotificationPermission;
      try {
        currentPermission = Notification.permission;
      } catch (error) {
        console.warn('Error accessing Notification.permission:', error);
        setPermission('unsupported');
        setIsSubscribed(false);
        return false;
      }

      if (currentPermission === "granted") {
        setPermission('granted');
        setIsSubscribed(true);
        console.log('✅ Notification permission already granted');
        return true;
      }

      if (currentPermission === "denied") {
        setPermission('denied');
        setIsSubscribed(false);
        console.log('❌ Notification permission was previously denied');
        return false;
      }

      // Request permission using native API (this will show browser popup)
      console.log('🔔 Requesting notification permission via native API...');
      let permission: NotificationPermission;
      try {
        permission = await Notification.requestPermission();
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        setPermission('unsupported');
        setIsSubscribed(false);
        return false;
      }
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

  // Check permission on mount and poll for OneSignal initialization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // IMMEDIATE CHECK: Use native permission first (synchronous, no waiting)
    checkPermission();

    // POLLING: Wait for OneSignal to initialize and sync subscription state
    // This fixes the race condition where OneSignal isn't ready when component mounts
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds max (60 * 500ms)
    
    const pollInterval = setInterval(() => {
      attempts++;
      
      if (window.OneSignal && window.__oneSignalReady) {
        // OneSignal is ready - sync permission state
        checkPermission();
        clearInterval(pollInterval);
      } else if (attempts >= maxAttempts) {
        // Timeout after 30 seconds - stop polling
        clearInterval(pollInterval);
        console.warn('⚠️ OneSignal initialization timeout - using native permission state only');
      }
    }, 500); // Check every 500ms

    return () => {
      clearInterval(pollInterval);
    };
  }, [checkPermission]);

  return {
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    checkPermission,
  };
}
