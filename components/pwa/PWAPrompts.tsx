'use client';

import { useState, createContext, useContext, useEffect, useCallback } from 'react';
import { usePWA, useDeviceDetect } from '@/hooks/common';
import { useLocale } from '@/hooks';
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
  const { t } = useLocale();
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const { isIOSDevice, isAndroidDevice } = useDeviceDetect();


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
      setShowAndroid(true);
    } else if (isInstallable && isIOSDevice) {
      setShowIOS(true);
    }
  }, [isInstallable, isAndroidDevice, hasPrompt, isIOSDevice, isInstalled]);

  const handleInstall = useCallback(async () => {
    if (!install) {
      return;
    }

    try {
      const success = await install();
      
      if (success) {
        setShowAndroid(false);
      }
      // Keep dialog open if installation wasn't successful
    } catch (err) {
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
              <DialogTitle>{t("pwa.installTitle")}</DialogTitle>
              <DialogDescription>
                {t("pwa.installDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>{t("pwa.benefits.fastAccess")}</li>
                <li>{t("pwa.benefits.offlineFunctionality")}</li>
                <li>{t("pwa.benefits.betterPerformance")}</li>
                <li>{t("pwa.benefits.appLikeExperience")}</li>
              </ul>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleDismiss}>
                  {t("pwa.later")}
                </Button>
                <Button onClick={handleInstall} variant="default">
                  {t("pwa.addToHomeScreen")}
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
