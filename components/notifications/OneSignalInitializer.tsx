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

  // PHASE 1: Clear corrupted OneSignal IndexedDB databases BEFORE initialization
  useEffect(() => {
    const cleanupOneSignalDatabases = async () => {
      try {
        // Defensive check: Ensure we're in a browser environment
        if (typeof window === 'undefined') {
          setDbCleanupComplete(true);
          return;
        }

        // Defensive check: Ensure indexedDB is available
        if (typeof indexedDB === 'undefined') {
          setDbCleanupComplete(true);
          return;
        }
        
        // Check if indexedDB.databases() is supported
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
        
        // Delete all OneSignal databases
        for (const db of oneSignalDbs) {
          if (db.name) {
            try {
              indexedDB.deleteDatabase(db.name);
            } catch (deleteError) {
              // Silently fail - proceed with cleanup
            }
          }
        }
        
        // Wait for deletions to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        setDbCleanupComplete(true);
        
      } catch (error) {
        // Always set cleanup complete even on error to prevent blocking initialization
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

  // PHASE 2: Initialize OneSignal ONLY after IndexedDB cleanup is complete
  useEffect(() => {
    // Don't initialize until cleanup is complete
    if (!dbCleanupComplete) {
      return;
    }

    const initOneSignal = () => {
      try {
        // Defensive check: Ensure we're in a browser environment
        if (typeof window === 'undefined') {
          return;
        }

        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId) {
          return;
        }
        
        // Use the proper OneSignal initialization pattern with defensive check
        if (!window.OneSignalDeferred) {
          window.OneSignalDeferred = [];
        }
        window.OneSignalDeferred.push(async function(OneSignal) {
          try {
            // CRITICAL FIX: Get current user and link external user ID BEFORE initialization
            // This prevents race condition where subscription happens before user ID is set
            const currentUserId = user?.id;
            if (currentUserId) {
              try {
                await OneSignal.login(currentUserId);
              } catch (linkError) {
                // Silently fail - will retry
              }
            }
            
            // CRITICAL: Add timeout wrapper to catch hanging initialization
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
                
                // Clear timeout if init succeeds
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }
                return result;
              } catch (error) {
                // Clear timeout on error too
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
            };
            
            await initWithTimeout(OneSignal, initConfig);
            
            window.__oneSignalReady = true;
            
          } catch (error) {
            // Gracefully degrade - don't crash the app
            // The app should continue to work without push notifications
          }
        });
        
      } catch (error) {
        // Gracefully degrade if setup fails
        // The app should continue to work without push notifications
      }
    };

    initOneSignal();
  }, [dbCleanupComplete, user?.id]); // Include user ID to ensure proper linking

  // Render custom notification prompt
  return (
    <NotificationPrompt
      isOpen={showPrompt}
      onClose={closePrompt}
      onEnable={() => {
        // User enabled notifications
      }}
    />
  );
}
