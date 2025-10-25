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
            
            // CRITICAL: Clear corrupted OneSignal IndexedDB before initialization
            try {
              console.log('🧹 Checking for corrupted OneSignal IndexedDB...');
              const dbNames = await indexedDB.databases();
              const oneSignalDb = dbNames.find(db => db.name?.includes('OneSignal'));
              
              if (oneSignalDb) {
                console.log('🗑️ Found OneSignal database, clearing to fix corruption...');
                indexedDB.deleteDatabase(oneSignalDb.name);
                // Wait a moment for deletion to complete
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (dbError) {
              console.log('ℹ️ IndexedDB cleanup skipped (not supported in this browser)');
            }
            
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
            if (error instanceof Error) {
              console.error('❌ Error details:', error.message, error.stack);
              
              // CRITICAL: If IndexedDB error, try clearing and retrying once
              if (error.message.includes('object store name') || error.message.includes('IndexedDB')) {
                console.log('🔄 IndexedDB error detected, attempting cleanup and retry...');
                try {
                  // Clear all OneSignal-related databases
                  const dbNames = await indexedDB.databases();
                  for (const db of dbNames) {
                    if (db.name?.includes('OneSignal')) {
                      indexedDB.deleteDatabase(db.name);
                    }
                  }
                  
                  // Wait and retry initialization
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  await OneSignal.init({
                    appId,
                    allowLocalhostAsSecureOrigin: true,
                    serviceWorkerParam: { scope: '/' },
                    serviceWorkerPath: 'OneSignalSDKWorker.js',
                    notifyButton: { enable: false },
                    promptOptions: { slidedown: { enabled: false } },
                    safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
                    path: '/api/onesignal/sdk/',
                  });
                  
                  console.log('✅ OneSignal initialized after IndexedDB cleanup');
                  window.__oneSignalReady = true;
                } catch (retryError) {
                  console.error('❌ OneSignal retry failed:', retryError);
                }
              }
            } else {
              console.error('❌ Error details:', String(error));
            }
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
