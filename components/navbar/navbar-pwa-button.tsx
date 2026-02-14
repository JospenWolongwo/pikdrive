"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import { Download } from "lucide-react";
import { useShowAndroidPrompt } from "@/components/pwa/PWAPrompts";
import { useLocale, usePWA, useDeviceDetect } from "@/hooks";

interface NavbarPWAButtonProps {
  readonly onShowIOSPrompt: () => void;
}

export function NavbarPWAButton({ onShowIOSPrompt }: NavbarPWAButtonProps) {
  const { setShowAndroid } = useShowAndroidPrompt();
  const { isInstallable, install } = usePWA();
  const { isIOSDevice, isAndroidDevice } = useDeviceDetect();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleInstallClick = async () => {
    if (isIOSDevice) {
      onShowIOSPrompt();
    } else if (isAndroidDevice) {
      try {
        const success = await install();
        if (!success) setShowAndroid(true);
      } catch (err) {
        console.error("Installation error:", err);
        setShowAndroid(true);
      }
    }
  };

  if (isIOSDevice) {
    return (
      <Button onClick={onShowIOSPrompt} variant="outline" size="sm" className="flex w-full items-center gap-2">
        <Download className="h-4 w-4" />
        <span>{t("pwa.installApp")}</span>
      </Button>
    );
  }

  if (isInstallable) {
    return (
      <Button onClick={handleInstallClick} variant="outline" size="sm" className="flex w-full items-center gap-2">
        <Download className="h-4 w-4" />
        <span>{t("pwa.installApp")}</span>
      </Button>
    );
  }

  return null;
}
