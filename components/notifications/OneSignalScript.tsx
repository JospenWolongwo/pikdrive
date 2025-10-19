'use client';

import { useEffect } from 'react';

/**
 * OneSignal Script Component
 * Handles the official OneSignal initialization pattern
 * 
 * This component runs the OneSignal initialization script
 * that would normally be inline in the HTML head
 */
export function OneSignalScript() {
  useEffect(() => {
    // Official OneSignal initialization pattern
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.init({
          appId: "144cd70b-0d97-4216-8cff-80d1c903b93d",
          allowLocalhostAsSecureOrigin: true,
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
        console.log('✅ OneSignal initialized via official pattern');
      } catch (error) {
        console.error('❌ OneSignal initialization failed:', error);
      }
    });
  }, []);

  return null; // This component doesn't render anything
}
