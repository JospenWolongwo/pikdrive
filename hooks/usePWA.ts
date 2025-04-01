'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }

  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent;
  }
}

// Time constants in milliseconds
const ONE_DAY = 24 * 60 * 60 * 1000; 
const THREE_DAYS = 3 * ONE_DAY;
const DISMISSAL_EXPIRY = THREE_DAYS; // Prompt reappears after 3 days

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);

  useEffect(() => {
    let promptEvent: BeforeInstallPromptEvent | null = null;

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      promptEvent = e;
      
      // Check if user has already dismissed or installed
      const hasUserInstalled = localStorage.getItem('pwa-installed') === 'true';
      
      // For dismissal, we need to check if it's still within the valid period
      const dismissedTimeStr = localStorage.getItem('pwa-dismissed-time');
      let isDismissalValid = false;
      
      if (dismissedTimeStr) {
        const dismissedTime = parseInt(dismissedTimeStr, 10);
        const currentTime = Date.now();
        const timeSinceDismissal = currentTime - dismissedTime;
        
        // Dismissal is only valid if it happened less than DISMISSAL_EXPIRY ago
        isDismissalValid = timeSinceDismissal < DISMISSAL_EXPIRY;
        
        console.log('🕒 PWA dismissal check:', { 
          dismissedTime, 
          currentTime, 
          timeSinceDismissal, 
          expiryTime: DISMISSAL_EXPIRY,
          isDismissalValid,
          daysUntilExpiry: Math.ceil((DISMISSAL_EXPIRY - timeSinceDismissal) / ONE_DAY)
        });
        
        // If dismissal has expired, clean up localStorage
        if (!isDismissalValid) {
          localStorage.removeItem('pwa-dismissed');
          localStorage.removeItem('pwa-dismissed-time');
        }
      }
      
      if (hasUserInstalled || isDismissalValid) {
        console.log('🔍 User previously installed PWA or has a valid dismissal');
        return;
      }
      
      // Store the event for later use
      window.deferredPrompt = e;
      setDeferredPrompt(e);
      setIsInstallable(true);
      setLastUpdated(Date.now());
      
      console.log('🎯 Install Prompt Ready:', { hasPrompt: true });
    };

    const handleAppInstalled = () => {
      console.log('✅ PWA Installed Successfully');
      localStorage.setItem('pwa-installed', 'true');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      window.deferredPrompt = undefined;
      setLastUpdated(Date.now());
    };

    const checkInstalled = () => {
      // Multiple checks for installed state
      const isInStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      
      // Check local storage as well
      const hasStoredInstallFlag = localStorage.getItem('pwa-installed') === 'true';
      
      // Set as installed if either condition is true
      const isAppInstalled = isInStandaloneMode || hasStoredInstallFlag;
      
      setIsInstalled(isAppInstalled);
      
      // If detected as installed, set the localStorage flag
      if (isInStandaloneMode && !hasStoredInstallFlag) {
        localStorage.setItem('pwa-installed', 'true');
      }
      
      setLastUpdated(Date.now());
      console.log('📱 PWA Install Check:', { 
        isInStandaloneMode, 
        hasStoredInstallFlag,
        isAppInstalled 
      });
    };

    // Set up event listeners
    if (typeof window !== 'undefined') {
      // Check if there's a deferred prompt already stored in the window object
      if (window.deferredPrompt) {
        handleBeforeInstallPrompt(window.deferredPrompt);
      }

      // Listen for the beforeinstallprompt event
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      // Check if already installed
      checkInstalled();

      // Check display mode changes
      const displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');
      const handleDisplayModeChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          localStorage.setItem('pwa-installed', 'true');
          setIsInstalled(true);
          setIsInstallable(false);
        }
        setLastUpdated(Date.now());
        console.log('🔄 Display Mode Changed:', { isStandalone: e.matches });
      };
      
      displayModeMediaQuery.addEventListener('change', handleDisplayModeChange);

      // Periodically check for installability on Android
      // This helps if the event was missed during initial page load
      const checkForInstallability = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isAndroid = /android/.test(userAgent);
        const hasUserInstalled = localStorage.getItem('pwa-installed') === 'true';
        
        // For dismissal, we need to check if it's still within the valid period
        const dismissedTimeStr = localStorage.getItem('pwa-dismissed-time');
        let isDismissalValid = false;
        
        if (dismissedTimeStr) {
          const dismissedTime = parseInt(dismissedTimeStr, 10);
          const currentTime = Date.now();
          const timeSinceDismissal = currentTime - dismissedTime;
          
          // Dismissal is only valid if it happened less than DISMISSAL_EXPIRY ago
          isDismissalValid = timeSinceDismissal < DISMISSAL_EXPIRY;
          
          // If dismissal has expired, clean up localStorage
          if (!isDismissalValid) {
            localStorage.removeItem('pwa-dismissed');
            localStorage.removeItem('pwa-dismissed-time');
          }
        }
        
        // Only set installable if not already installed or within valid dismissal period
        if (isAndroid && !isInstalled && !deferredPrompt && !isDismissalValid && !hasUserInstalled) {
          setIsInstallable(true);
          console.log('🔍 Android device detected, setting installable');
        }
      };
      
      // Run once after a short delay
      setTimeout(checkForInstallability, 2000);

      // Cleanup
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        displayModeMediaQuery.removeEventListener('change', handleDisplayModeChange);
      };
    }
  }, [deferredPrompt, isInstalled]);

  const install = useCallback(async () => {
    console.log('🚀 Install requested', { hasPrompt: !!deferredPrompt });
    
    // Check if we have a stored prompt first in the component state
    let promptToUse = deferredPrompt;
    
    // If not in state, check window object as fallback
    if (!promptToUse && window.deferredPrompt) {
      promptToUse = window.deferredPrompt;
      setDeferredPrompt(window.deferredPrompt);
    }
    
    if (!promptToUse) {
      console.log('❌ No installation prompt available');
      return false;
    }

    try {
      console.log('🚀 Triggering install prompt...');
      await promptToUse.prompt();
      const choiceResult = await promptToUse.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('✅ User accepted the PWA installation');
        localStorage.setItem('pwa-installed', 'true');
        setIsInstalled(true);
        setDeferredPrompt(null);
        window.deferredPrompt = undefined;
        return true;
      } else {
        console.log('❌ User dismissed the PWA installation');
        localStorage.setItem('pwa-dismissed', 'true');
        localStorage.setItem('pwa-dismissed-time', Date.now().toString());
        return false;
      }
    } catch (err) {
      console.error('❌ Error installing PWA:', err);
      return false;
    }
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    // Store current timestamp with dismissal
    localStorage.setItem('pwa-dismissed', 'true');
    localStorage.setItem('pwa-dismissed-time', Date.now().toString());
    setIsInstallable(false);
  }, []);

  return { 
    isInstallable, 
    isInstalled, 
    install,
    dismissPrompt,
    hasPrompt: !!deferredPrompt,
    lastUpdated
  };
}
