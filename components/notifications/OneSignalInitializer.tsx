'use client';

import { useEffect, useState } from 'react';
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
  
  // State to track IndexedDB cleanup completion
  const [dbCleanupComplete, setDbCleanupComplete] = useState(false);

  // PHASE 1: Clear corrupted OneSignal IndexedDB databases BEFORE initialization
  useEffect(() => {
    const cleanupOneSignalDatabases = async () => {
      try {
        console.log('🧹 PHASE 1: Cleaning up OneSignal IndexedDB databases...');
        
        // Check if indexedDB.databases() is supported
        if (!('databases' in indexedDB)) {
          console.log('ℹ️ IndexedDB.databases() not supported, skipping cleanup');
          setDbCleanupComplete(true);
          return;
        }

        const dbNames = await indexedDB.databases();
        const oneSignalDbs = dbNames.filter(db => db.name?.includes('OneSignal'));
        
        if (oneSignalDbs.length === 0) {
          console.log('✅ No OneSignal databases found, proceeding with initialization');
          setDbCleanupComplete(true);
          return;
        }

        console.log(`🗑️ Found ${oneSignalDbs.length} OneSignal database(s), clearing...`);
        
        // Delete all OneSignal databases
        for (const db of oneSignalDbs) {
          if (db.name) {
            console.log(`🗑️ Deleting database: ${db.name}`);
            indexedDB.deleteDatabase(db.name);
          }
        }
        
        // Wait for deletions to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('✅ OneSignal databases cleared successfully');
        setDbCleanupComplete(true);
        
      } catch (error) {
        console.error('❌ IndexedDB cleanup failed:', error);
        console.log('ℹ️ Proceeding with initialization anyway...');
        setDbCleanupComplete(true);
      }
    };

    cleanupOneSignalDatabases();
  }, []);

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

  // PHASE 2: Initialize OneSignal ONLY after IndexedDB cleanup is complete
  useEffect(() => {
    // Don't initialize until cleanup is complete
    if (!dbCleanupComplete) {
      console.log('⏳ Waiting for IndexedDB cleanup to complete...');
      return;
    }

    const initOneSignal = () => {
      try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        if (!appId) {
          console.warn('⚠️ NEXT_PUBLIC_ONESIGNAL_APP_ID is not set; OneSignal will not initialize');
          return;
        }

        console.log('🔧 PHASE 2: Setting up OneSignal deferred initialization...');
        console.log('🔍 OneSignal SDK script should be loaded from: /api/onesignal/sdk/OneSignalSDK.page.js');
        
        // Use the proper OneSignal initialization pattern
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
          try {
            console.log('🔧 OneSignal deferred callback executing...');
            console.log('🔍 OneSignal object available:', !!OneSignal);
            console.log('🔍 Service worker path will be: OneSignalSDKWorker.js');
            
            // CRITICAL: Add timeout wrapper to catch hanging initialization
            const initWithTimeout = async (OneSignal: any, config: any, timeoutMs = 30000) => {
              console.log('⏱️ Starting OneSignal initialization with 30s timeout...');
              
              let timeoutId: NodeJS.Timeout;
              
              const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                  console.error('⏰ OneSignal initialization timed out after 30 seconds');
                  reject(new Error('OneSignal init timeout - initialization hung'));
                }, timeoutMs);
              });
              
              try {
                const result = await Promise.race([
                  OneSignal.init(config),
                  timeoutPromise
                ]);
                
                // Clear timeout if init succeeds
                clearTimeout(timeoutId);
                return result;
              } catch (error) {
                // Clear timeout on error too
                clearTimeout(timeoutId);
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
            
            console.log('🔧 Calling OneSignal.init() with config:', {
              appId: initConfig.appId ? 'SET' : 'MISSING',
              serviceWorkerPath: initConfig.serviceWorkerPath,
              path: initConfig.path,
              allowLocalhostAsSecureOrigin: initConfig.allowLocalhostAsSecureOrigin
            });
            
            // Quick test: Verify service worker routes are accessible
            try {
              console.log('🔍 Testing service worker route accessibility...');
              const swTestResponse = await fetch('/OneSignalSDKWorker.js', { method: 'HEAD' });
              console.log('✅ Service worker route accessible:', swTestResponse.status);
            } catch (swTestError) {
              console.warn('⚠️ Service worker route test failed:', swTestError);
            }
            
            // Check for existing service workers that might conflict
            try {
              console.log('🔍 Checking for existing service workers...');
              const existingRegistrations = await navigator.serviceWorker.getRegistrations();
              if (existingRegistrations.length > 0) {
                console.log(`⚠️ Found ${existingRegistrations.length} existing service worker(s):`, existingRegistrations);
                console.log('ℹ️ OneSignal will merge with existing service workers');
              } else {
                console.log('✅ No existing service workers found - clean slate');
              }
            } catch (swCheckError) {
              console.warn('⚠️ Error checking existing service workers:', swCheckError);
            }
            
            await initWithTimeout(OneSignal, initConfig);
            
            console.log('✅ OneSignal initialized successfully with clean database');
            console.log('🔍 Service worker should now be registering...');
            window.__oneSignalReady = true;
            
            // CRITICAL: Verify service worker registration and add fallback
            setTimeout(async () => {
              try {
                console.log('🔍 Verifying service worker registration...');
                const registration = await navigator.serviceWorker.getRegistration();
                
                if (registration) {
                  console.log('✅ Service worker confirmed registered:', registration);
                  console.log('✅ OneSignal setup complete - notifications ready!');
                } else {
                  console.warn('⚠️ Service worker not found after OneSignal init');
                  console.log('🔧 Attempting manual service worker registration...');
                  
                  try {
                    // Manual fallback registration
                    const manualRegistration = await navigator.serviceWorker.register('/OneSignalSDKWorker.js', {
                      scope: '/'
                    });
                    console.log('✅ Manual service worker registration successful:', manualRegistration);
                  } catch (manualError) {
                    console.error('❌ Manual service worker registration failed:', manualError);
                    console.log('🔧 DIAGNOSTIC STEPS:');
                    console.log('1. Check browser DevTools → Application → Service Workers');
                    console.log('2. Verify /OneSignalSDKWorker.js is accessible');
                    console.log('3. Check for CSP (Content Security Policy) blocking service workers');
                    console.log('4. Ensure HTTPS is enabled (required for service workers)');
                  }
                }
              } catch (swError) {
                console.error('❌ Error checking service worker:', swError);
              }
            }, 3000); // Increased delay to give OneSignal more time
            
          } catch (error) {
            console.error('❌ OneSignal initialization failed:', error);
            if (error instanceof Error) {
              console.error('❌ Error details:', error.message);
              
              // Enhanced error diagnostics
              if (error.message.includes('timeout')) {
                console.log('🔧 TIMEOUT DIAGNOSTICS:');
                console.log('1. Check browser DevTools → Network tab for failed requests');
                console.log('2. Look for OneSignalSDKWorker.js or OneSignalSDK.sw.js errors');
                console.log('3. Check if service worker registration is blocked by CSP');
                console.log('4. Verify /api/onesignal/sdk/ routes are accessible');
              } else if (error.message.includes('object store name') || error.message.includes('IndexedDB')) {
                console.log('🔧 Manual cleanup required:');
                console.log('1. Open browser DevTools (F12)');
                console.log('2. Go to Application tab → Storage → IndexedDB');
                console.log('3. Delete all databases containing "OneSignal"');
                console.log('4. Refresh the page');
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
  }, [dbCleanupComplete]); // Only run when cleanup is complete

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
