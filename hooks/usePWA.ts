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
      
      // Store the event for later use
      window.deferredPrompt = e;
      setDeferredPrompt(e);
      setIsInstallable(true);
      setLastUpdated(Date.now());
      
      console.log('🎯 Install Prompt Ready:', { hasPrompt: true });
    };

    const handleAppInstalled = () => {
      console.log('✅ PWA Installed Successfully');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      window.deferredPrompt = undefined;
      setLastUpdated(Date.now());
    };

    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
      setLastUpdated(Date.now());
      console.log('📱 PWA Install Check:', { isStandalone });
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
        setIsInstalled(e.matches);
        setLastUpdated(Date.now());
        console.log('🔄 Display Mode Changed:', { isStandalone: e.matches });
      };
      
      displayModeMediaQuery.addEventListener('change', handleDisplayModeChange);

      // Periodically check for installability on Android
      // This helps if the event was missed during initial page load
      const checkForInstallability = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isAndroid = /android/.test(userAgent);
        
        if (isAndroid && !isInstalled && !deferredPrompt) {
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
        setIsInstalled(true);
        setDeferredPrompt(null);
        window.deferredPrompt = undefined;
        return true;
      } else {
        console.log('❌ User dismissed the PWA installation');
        return false;
      }
    } catch (err) {
      console.error('❌ Error installing PWA:', err);
      return false;
    }
  }, [deferredPrompt]);

  return { 
    isInstallable, 
    isInstalled, 
    install,
    hasPrompt: !!deferredPrompt,
    lastUpdated
  };
}
