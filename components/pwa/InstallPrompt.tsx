'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';
import { useLocale } from '@/hooks';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const { t } = useLocale();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const hasInteracted = localStorage.getItem('pwaPromptInteraction');
    if (hasInteracted) return;

    const handler = (e: Event) => {
      e.preventDefault(); // Chrome 67 and earlier would auto-show; we use custom UI
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setShowPrompt(false);

    localStorage.setItem('pwaPromptInteraction', 'true');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setIsDismissed(true);
    const dismissalTime = Date.now();
    localStorage.setItem('pwaPromptDismissalTime', dismissalTime.toString()); // Allows re-prompt after 24h
  };

  if (!showPrompt || isDismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[360px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1 mr-4">
          <h3 className="font-semibold text-lg mb-1">{t("pwa.installTitle")}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("pwa.installDescription")}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Dismiss"
        >
          <X size={20} />
        </button>
      </div>
      <div className="mt-4 flex gap-3">
        <Button
          onClick={handleInstall}
          className="flex-1"
          variant="default"
        >
          {t("pwa.installNow")}
        </Button>
        <Button
          onClick={handleDismiss}
          variant="outline"
          className="flex-1"
        >
          {t("pwa.maybeLater")}
        </Button>
      </div>
    </div>
  );
}
