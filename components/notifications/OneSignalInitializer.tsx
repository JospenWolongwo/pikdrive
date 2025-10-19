'use client';

import { useEffect } from 'react';
import { useOneSignal } from '@/hooks/notifications/useOneSignal';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useNotificationPrompt } from '@/hooks/notifications/useNotificationPrompt';
import { NotificationPrompt } from './NotificationPrompt';
// OneSignalScript removed - initialization handled directly here

/**
 * OneSignal Initialization Component
 * Handles OneSignal SDK initialization and user linking
 * 
 * Best Practices:
 * - Initializes once on app load
 * - Links user ID when authenticated
 * - Unlinks on logout
 * - Shows custom permission prompt
 * - Follows Uber/DoorDash patterns
 */
export function OneSignalInitializer() {
  const { initialize, setUserId, removeUserId, isInitialized } = useOneSignal();
  const { user } = useSupabase();
  const { showPrompt, closePrompt } = useNotificationPrompt();

  // Initialize OneSignal once
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Link/unlink user ID based on auth state
  useEffect(() => {
    if (!isInitialized) return;

    const handleAuthChange = async () => {
      if (user?.id) {
        // User logged in - link OneSignal external user ID
        try {
          await setUserId(user.id);
          console.log('✅ OneSignal user linked:', user.id);
        } catch (error) {
          console.error('❌ Failed to link OneSignal user:', error);
        }
      } else {
        // User logged out - unlink OneSignal external user ID
        try {
          await removeUserId();
          console.log('✅ OneSignal user unlinked');
        } catch (error) {
          console.error('❌ Failed to unlink OneSignal user:', error);
        }
      }
    };

    handleAuthChange();
  }, [user, isInitialized, setUserId, removeUserId]);

  // Initialize OneSignal directly
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId) {
          console.warn('⚠️ NEXT_PUBLIC_ONESIGNAL_APP_ID is not set; OneSignal will not initialize');
          return;
        }

        // Wait for OneSignal SDK to be available
        if (typeof window !== 'undefined' && window.OneSignal) {
          await window.OneSignal.init({
            appId,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: '/' },
            serviceWorkerPath: 'OneSignalSDKWorker.js',
            path: '/api/onesignal/sdk/',
            notifyButton: {
              enable: false, // We'll use custom UI
            },
            promptOptions: {
              slidedown: {
                enabled: false, // Disable automatic prompts
              },
            },
            safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
          });
          console.log('✅ OneSignal initialized directly');
          window.__oneSignalReady = true;
        }
      } catch (error) {
        console.error('❌ OneSignal initialization failed:', error);
      }
    };

    initOneSignal();
  }, []);

  // Render custom notification prompt
  return (
    <NotificationPrompt
      isOpen={showPrompt}
      onClose={closePrompt}
      onEnable={() => {
        console.log('✅ User enabled notifications via custom prompt');
      }}
    />
  );
}
