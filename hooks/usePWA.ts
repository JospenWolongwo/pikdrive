'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

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
  const [installedDate, setInstalledDate] = useLocalStorage<string | null>('pwa_installed_date', null);

  const checkIsInstalled = useCallback(() => {
    if (typeof window === 'undefined') return false;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true;
    
    // Check if installed via manifest
    const manifestInstalled = document.querySelector('link[rel="manifest"]') !== null &&
                            window.matchMedia('(display-mode: standalone)').matches;
    
    // Check if installed via Safari "Add to Home Screen"
    const safariInstalled = (window.navigator as any).standalone === true;
    
    // Check if running as TWA (Trusted Web Activity)
    const isTWA = document.referrer.includes('android-app://');
    
    // Check localStorage for previous installation
    const hasBeenInstalled = installedDate !== null;

    const isActuallyInstalled = isStandalone || manifestInstalled || safariInstalled || isTWA || hasBeenInstalled;
    
    console.log('📱 Installation Check:', {
      isStandalone,
      manifestInstalled,
      safariInstalled,
      isTWA,
      hasBeenInstalled,
      isActuallyInstalled
    });

    return isActuallyInstalled;
  }, [installedDate]);

  useEffect(() => {
    const isCurrentlyInstalled = checkIsInstalled();
    setIsInstalled(isCurrentlyInstalled);
    
    if (isCurrentlyInstalled) {
      setIsInstallable(false);
      setDeferredPrompt(null);
      window.deferredPrompt = undefined;
    }
  }, [checkIsInstalled]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // If already installed, don't show the prompt
      if (checkIsInstalled()) {
        console.log('🏠 App already installed, preventing prompt');
        return;
      }

      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      
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
      // Save installation date
      setInstalledDate(new Date().toISOString());
      setLastUpdated(Date.now());
    };

    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) { // If now in standalone mode
        setIsInstalled(true);
        setIsInstallable(false);
        setLastUpdated(Date.now());
        // Save installation date if not already saved
        if (!installedDate) {
          setInstalledDate(new Date().toISOString());
        }
      }
      console.log('🔄 Display Mode Changed:', { isStandalone: e.matches });
    };

    // Set up event listeners
    if (typeof window !== 'undefined') {
      // Check if there's a deferred prompt already stored
      if (window.deferredPrompt && !checkIsInstalled()) {
        handleBeforeInstallPrompt(window.deferredPrompt);
      }

      // Listen for install prompt
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      // Listen for display mode changes
      const displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');
      displayModeMediaQuery.addEventListener('change', handleDisplayModeChange);

      // Check if already in standalone mode
      if (displayModeMediaQuery.matches) {
        setIsInstalled(true);
        setIsInstallable(false);
        if (!installedDate) {
          setInstalledDate(new Date().toISOString());
        }
      }

      // Cleanup
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        displayModeMediaQuery.removeEventListener('change', handleDisplayModeChange);
      };
    }
  }, [checkIsInstalled, installedDate, setInstalledDate]);

  const install = useCallback(async () => {
    // Don't attempt to install if already installed
    if (checkIsInstalled()) {
      console.log('🏠 App already installed, ignoring install request');
      return false;
    }

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
        setInstalledDate(new Date().toISOString());
        return true;
      } else {
        console.log('❌ User dismissed the PWA installation');
        return false;
      }
    } catch (err) {
      console.error('❌ Error installing PWA:', err);
      return false;
    }
  }, [deferredPrompt, checkIsInstalled, setInstalledDate]);

  return { 
    isInstallable: isInstallable && !isInstalled, 
    isInstalled, 
    install,
    hasPrompt: !!deferredPrompt && !isInstalled,
    lastUpdated,
    installedDate
  };
}
