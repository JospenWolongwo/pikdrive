'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AndroidInstallPromptProps {
  show: boolean;
  onDismiss: () => void;
  onInstall: () => void;
}

export function AndroidInstallPrompt({ show, onDismiss, onInstall }: AndroidInstallPromptProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6 relative">
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-4">
          <h3 className="font-semibold text-xl">Install PikDrive App</h3>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Install PikDrive on your Android device for the best experience:
            </p>
            
            <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start">
                <span className="mr-2">1.</span>
                <span>Click "Install App" below</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">2.</span>
                <span>When prompted, tap "Install"</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">3.</span>
                <span>Open PikDrive from your home screen</span>
              </li>
            </ol>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onDismiss}
            >
              Maybe Later
            </Button>
            <Button
              variant="default"
              onClick={() => {
                console.log('🤖 User clicked Android install button');
                onInstall();
              }}
            >
              Install App
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
