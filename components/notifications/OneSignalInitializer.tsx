'use client';

import { useEffect } from 'react';
import { useOneSignal } from '@/hooks/notifications/useOneSignal';
import { useSupabase } from '@/providers/SupabaseProvider';

/**
 * OneSignal Initialization Component
 * Handles OneSignal SDK initialization and user linking
 * 
 * Best Practices:
 * - Initializes once on app load
 * - Links user ID when authenticated
 * - Unlinks on logout
 * - Follows Uber/DoorDash patterns
 */
export function OneSignalInitializer() {
  const { initialize, setUserId, removeUserId, isInitialized } = useOneSignal();
  const { user } = useSupabase();

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

  // This component doesn't render anything
  return null;
}
