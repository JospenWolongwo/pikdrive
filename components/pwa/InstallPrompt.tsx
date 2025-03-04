'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed or installed
    const hasInteracted = localStorage.getItem('pwaPromptInteraction');
    if (hasInteracted) return;

    const handler = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show our custom prompt after a delay
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // Clear the deferredPrompt for next time
    setDeferredPrompt(null);
    setShowPrompt(false);
    
    // Record the interaction
    localStorage.setItem('pwaPromptInteraction', 'true');
    
    // Optional: Track the outcome
    if (outcome === 'accepted') {
      // You could send analytics here
      console.log('User accepted the install prompt');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setIsDismissed(true);
    // Store the dismissal but allow the prompt to show again after 24 hours
    const dismissalTime = Date.now();
    localStorage.setItem('pwaPromptDismissalTime', dismissalTime.toString());
  };

  // Don't render anything if conditions aren't met
  if (!showPrompt || isDismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[360px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1 mr-4">
          <h3 className="font-semibold text-lg mb-1">Install PikDrive</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Install our app for a better experience with quick access and offline features
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
          Install Now
        </Button>
        <Button
          onClick={handleDismiss}
          variant="outline"
          className="flex-1"
        >
          Maybe Later
        </Button>
      </div>
    </div>
  );
}
