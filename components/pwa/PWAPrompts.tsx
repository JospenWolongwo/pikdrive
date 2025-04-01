'use client';

import { useState, createContext, useContext, useEffect, useCallback } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IOSInstallPrompt } from './IOSInstallPrompt';

// Create context for showing Android prompt
export const ShowAndroidPromptContext = createContext<{
  showAndroid: boolean;
  setShowAndroid: (show: boolean) => void;
}>({ showAndroid: false, setShowAndroid: () => {} });

export function useShowAndroidPrompt() {
  const context = useContext(ShowAndroidPromptContext);
  if (!context) {
    throw new Error('useShowAndroidPrompt must be used within PWAPrompts');
  }
  return context;
}

export default function PWAPrompts() {
  const { isInstallable, hasPrompt, install, isInstalled, dismissPrompt } = usePWA();
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const { isIOSDevice, isAndroidDevice } = useDeviceDetect();

  useEffect(() => {
    console.log('🔍 PWAPrompts Debug:', { 
      showAndroid, 
      isInstallable, 
      hasPrompt,
      isInstalled,
      isIOSDevice,
      isAndroidDevice,
      env: process.env.NODE_ENV 
    });
  }, [showAndroid, isInstallable, hasPrompt, isIOSDevice, isAndroidDevice, isInstalled]);

  // Show appropriate prompt on initial load
  useEffect(() => {
    if (isInstalled) {
      // If already installed, don't show any prompts
      setShowAndroid(false);
      setShowIOS(false);
      return;
    }
    
    if (isInstallable && isAndroidDevice && !hasPrompt) {
      // Only show our custom dialog if there's no native prompt
      console.log('ℹ️ No native prompt available on load, showing custom dialog');
      setShowAndroid(true);
    } else if (isInstallable && isIOSDevice) {
      setShowIOS(true);
    }
  }, [isInstallable, isAndroidDevice, hasPrompt, isIOSDevice, isInstalled]);

  const handleInstall = useCallback(async () => {
    if (!install) {
      console.log('❌ Install function not available');
      return;
    }

    try {
      console.log('🚀 Attempting installation from dialog...');
      const success = await install();
      
      if (success) {
        console.log('✅ Installation successful');
        setShowAndroid(false);
      } else {
        console.log('ℹ️ Installation not completed');
        // Keep dialog open if installation wasn't successful
      }
    } catch (err) {
      console.error('❌ Installation error:', err);
      // Keep dialog open if there was an error
    }
  }, [install]);

  const handleDismiss = useCallback(() => {
    dismissPrompt();
    setShowAndroid(false);
    setShowIOS(false);
  }, [dismissPrompt]);

  return (
    <ShowAndroidPromptContext.Provider value={{ showAndroid, setShowAndroid }}>
      {showAndroid && isAndroidDevice && (
        <Dialog open={showAndroid} onOpenChange={(open) => {
          if (!open) handleDismiss();
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Install PikDrive App</DialogTitle>
              <DialogDescription>
                Get quick access and a better experience by installing PikDrive on your device.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Fast access from your home screen</li>
                <li>Offline functionality</li>
                <li>Better performance</li>
                <li>App-like experience</li>
              </ul>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleDismiss}>
                  Later
                </Button>
                <Button onClick={handleInstall} variant="default">
                  Add to Home Screen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <IOSInstallPrompt show={showIOS && isIOSDevice} onClose={handleDismiss} />
    </ShowAndroidPromptContext.Provider>
  );
}
