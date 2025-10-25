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
  const { setUserId, removeUserId, isInitialized } = useOneSignal();
  const { user } = useSupabase();
  const { showPrompt, closePrompt } = useNotificationPrompt();

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

  // Initialize OneSignal using the proper deferred pattern
  useEffect(() => {
    const initOneSignal = () => {
      try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId) {
          console.warn('⚠️ NEXT_PUBLIC_ONESIGNAL_APP_ID is not set; OneSignal will not initialize');
          return;
        }

        console.log('🔧 Setting up OneSignal deferred initialization...');
        console.log('🔍 OneSignal SDK script should be loaded from: /api/onesignal/sdk/OneSignalSDK.page.js');
        
        // Use the proper OneSignal initialization pattern
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
          try {
            console.log('🔧 OneSignal deferred callback executing...');
            console.log('🔍 OneSignal object available:', !!OneSignal);
            console.log('🔍 Service worker path will be: OneSignalSDKWorker.js');
            
            await OneSignal.init({
              appId,
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerParam: { scope: '/' },
              serviceWorkerPath: 'OneSignalSDKWorker.js',
              notifyButton: {
                enable: false, // We'll use custom UI
              },
              promptOptions: {
                slidedown: {
                  enabled: false, // Disable automatic prompts
                },
              },
              safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
              // Configure SDK proxy to avoid tracking protection
              path: '/api/onesignal/sdk/',
            });
            console.log('✅ OneSignal initialized via deferred pattern');
            console.log('🔍 Service worker should now be registering...');
            window.__oneSignalReady = true;
          } catch (error) {
            console.error('❌ OneSignal deferred initialization failed:', error);
            console.error('❌ Error details:', error.message, error.stack);
          }
        });
        
        console.log('✅ OneSignal deferred queue configured');
        console.log('🔍 Waiting for OneSignal SDK to load and execute deferred callbacks...');
      } catch (error) {
        console.error('❌ OneSignal setup failed:', error);
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
