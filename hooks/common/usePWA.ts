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
        
        // If dismissal has expired, clean up localStorage
        if (!isDismissalValid) {
          localStorage.removeItem('pwa-dismissed');
          localStorage.removeItem('pwa-dismissed-time');
        }
      }
      
      if (hasUserInstalled || isDismissalValid) {
        return;
      }
      
      window.deferredPrompt = e;
      setDeferredPrompt(e);
      setIsInstallable(true);
      setLastUpdated(Date.now());
    };

    const handleAppInstalled = () => {
      localStorage.setItem('pwa-installed', 'true');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      window.deferredPrompt = undefined;
      setLastUpdated(Date.now());
    };

    const checkInstalled = () => {
      // Multiple checks for installed state (standalone, iOS, Android app shell)
      const isInStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      
      const hasStoredInstallFlag = localStorage.getItem('pwa-installed') === 'true';
      const isAppInstalled = isInStandaloneMode || hasStoredInstallFlag;
      
      setIsInstalled(isAppInstalled);
      
      // If detected as installed, set the localStorage flag
      if (isInStandaloneMode && !hasStoredInstallFlag) {
        localStorage.setItem('pwa-installed', 'true');
      }
      
      setLastUpdated(Date.now());
    };

    if (typeof window !== 'undefined') {
      // Window object may already have a deferred prompt from prior navigation
      if (window.deferredPrompt) {
        handleBeforeInstallPrompt(window.deferredPrompt);
      }

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      checkInstalled();

      const displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');
      const handleDisplayModeChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          localStorage.setItem('pwa-installed', 'true');
          setIsInstalled(true);
          setIsInstallable(false);
        }
        setLastUpdated(Date.now());
      };
      
      displayModeMediaQuery.addEventListener('change', handleDisplayModeChange);

      // Delayed check for Android - helps if beforeinstallprompt was missed during initial load
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
        }
      };
      
      setTimeout(checkForInstallability, 2000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        displayModeMediaQuery.removeEventListener('change', handleDisplayModeChange);
      };
    }
  }, [deferredPrompt, isInstalled]);

  const install = useCallback(async () => {
    let promptToUse = deferredPrompt;
    
    // Window object as fallback if event was captured before mount
    if (!promptToUse && window.deferredPrompt) {
      promptToUse = window.deferredPrompt;
      setDeferredPrompt(window.deferredPrompt);
    }
    
    if (!promptToUse) {
      return false;
    }

    try {
      await promptToUse.prompt();
      const choiceResult = await promptToUse.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        localStorage.setItem('pwa-installed', 'true');
        setIsInstalled(true);
        setDeferredPrompt(null);
        window.deferredPrompt = undefined;
        return true;
      } else {
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
