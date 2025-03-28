'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
      console.log('📱 PWA Install Check:', { isStandalone });
    };

    checkInstalled();

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('🎯 Install Prompt Ready');
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('✅ PWA Installed Successfully');
    };

    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
      console.log('🔄 Display Mode Changed:', { isStandalone: e.matches });
    };

    const displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');
    displayModeMediaQuery.addEventListener('change', handleDisplayModeChange);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      displayModeMediaQuery.removeEventListener('change', handleDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) {
      console.log('❌ No installation prompt available');
      return;
    }

    try {
      console.log('🚀 Triggering install prompt...');
      // Show the prompt
      await deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('✅ User accepted the PWA installation');
        setIsInstalled(true);
      } else {
        console.log('❌ User dismissed the PWA installation');
      }
      // Clear the prompt
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (err) {
      console.error('❌ Error installing PWA:', err);
    }
  };

  return { 
    isInstallable, 
    isInstalled, 
    install,
    hasPrompt: !!deferredPrompt 
  };
}
