'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

// Add type definitions for Safari-specific properties
interface SafariNavigator extends Navigator {
  standalone?: boolean;
}

// Helper function to detect iOS
const isIOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) && 
         !userAgent.includes('windows phone') && // Exclude Windows Phone
         !userAgent.includes('android'); // Exclude Android tablets
};

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isiOSDevice = isIOS();
    // Check if it's in standalone mode (already installed)
    const isStandalone = (window.navigator as SafariNavigator).standalone === true;
    // Check if user has dismissed before
    const hasInteracted = localStorage.getItem('iosPromptInteraction');

    if (isiOSDevice && !isStandalone && !hasInteracted) {
      // Delay showing the prompt
      setTimeout(() => setShowPrompt(true), 2000);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('iosPromptInteraction', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[360px] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-50 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1 mr-4">
          <h3 className="font-semibold text-lg mb-1">Install PikDrive</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Install our app on your iOS device:
          </p>
          <ol className="text-sm text-gray-600 dark:text-gray-300 mt-2 list-decimal pl-4">
            <li>Tap the Share button</li>
            <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
            <li>Tap &quot;Add&quot; to install</li>
          </ol>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Dismiss"
        >
          <X size={20} />
        </button>
      </div>
      <div className="mt-4">
        <Button
          onClick={handleDismiss}
          variant="outline"
          className="w-full"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
