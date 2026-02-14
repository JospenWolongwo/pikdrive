'use client';

import { useEffect, useState } from 'react';
import { useOneSignal, useNotificationPrompt } from "@/hooks/notifications";
import { useSupabase } from '@/providers/SupabaseProvider';
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
  
  // State to track IndexedDB cleanup completion
  const [dbCleanupComplete, setDbCleanupComplete] = useState(false);

  useEffect(() => {
    const cleanupOneSignalDatabases = async () => {
      try {
        if (typeof window === 'undefined') {
          setDbCleanupComplete(true);
          return;
        }

        if (typeof indexedDB === 'undefined') {
          setDbCleanupComplete(true);
          return;
        }
        
        if (!('databases' in indexedDB)) {
          setDbCleanupComplete(true);
          return;
        }

        const dbNames = await indexedDB.databases();
        const oneSignalDbs = dbNames.filter(db => db.name?.includes('OneSignal'));
        
        if (oneSignalDbs.length === 0) {
          setDbCleanupComplete(true);
          return;
        }
        
        for (const db of oneSignalDbs) {
          if (db.name) {
            try {
              indexedDB.deleteDatabase(db.name);
            } catch (deleteError) {
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        setDbCleanupComplete(true);
        
      } catch (error) {
        setDbCleanupComplete(true);
      }
    };

    cleanupOneSignalDatabases();
  }, []);

  // Link/unlink user ID based on auth state and ensure linking happens immediately
  useEffect(() => {
    if (!isInitialized) return;

    const handleAuthChange = async () => {
      if (user?.id) {
        // User logged in - link OneSignal external user ID IMMEDIATELY
        try {
          await setUserId(user.id);
        } catch (error) {
          // Silently fail - user linking will retry
        }
      } else {
        // User logged out - unlink OneSignal external user ID
        try {
          await removeUserId();
        } catch (error) {
          // Silently fail - unlinking will retry
        }
      }
    };

    handleAuthChange();
  }, [user, isInitialized, setUserId, removeUserId]);

  useEffect(() => {
    if (!dbCleanupComplete) {
      return;
    }

    const initOneSignal = () => {
      try {
        if (typeof window === 'undefined') {
          return;
        }

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId) {
          return;
        }
        
        if (!window.OneSignalDeferred) {
          window.OneSignalDeferred = [];
        }
        window.OneSignalDeferred.push(async function(OneSignal) {
          try {
            const currentUserId = user?.id;
            if (currentUserId) {
              try {
                await OneSignal.login(currentUserId);
              } catch (linkError) {
              }
            }
            
            const initWithTimeout = async (OneSignal: any, config: any, timeoutMs = 30000) => {
              let timeoutId: NodeJS.Timeout | undefined;
              
              const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                  reject(new Error('OneSignal init timeout - initialization hung'));
                }, timeoutMs);
              });
              
              try {
                const result = await Promise.race([
                  OneSignal.init(config),
                  timeoutPromise
                ]);
                
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }
                return result;
              } catch (error) {
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }
                throw error;
              }
            };
            
            const initConfig = {
              appId,
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerParam: { scope: '/' },
              serviceWorkerPath: 'OneSignalSDKWorker.js',
              notifyButton: {
                enable: false,
              },
              promptOptions: {
                slidedown: {
                  enabled: false,
                },
              },
              safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
              path: '/api/onesignal/sdk/',
            };
            
            await initWithTimeout(OneSignal, initConfig);
            
            window.__oneSignalReady = true;
            
          } catch (error) {
          }
        });
        
      } catch (error) {
      }
    };

    initOneSignal();
  }, [dbCleanupComplete, user?.id]); // Include user ID to ensure proper linking

  // Render custom notification prompt
  return (
    <NotificationPrompt
      isOpen={showPrompt}
      onClose={closePrompt}
      onEnable={() => {}}
    />
  );
}
