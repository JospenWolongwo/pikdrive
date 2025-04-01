'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from 'next/image';

export interface IOSInstallPromptProps {
  show: boolean;
  onClose: () => void;
}

export function IOSInstallPrompt({ show, onClose }: IOSInstallPromptProps) {
  const handleDismiss = () => {
    // Store the dismissal in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('pwa-dismissed', 'true');
    }
    onClose();
  };
  
  return (
    <Dialog open={show} onOpenChange={handleDismiss}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Install PikDrive App</DialogTitle>
          <DialogDescription>
            Follow these steps to add PikDrive to your Home Screen
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-full p-2 flex-shrink-0">
              <span className="text-xl">1</span>
            </div>
            <p>Tap the share button <Image src="/images/share-ios.png" alt="iOS Share button" width={20} height={20} className="inline-block" /></p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-full p-2 flex-shrink-0">
              <span className="text-xl">2</span>
            </div>
            <p>Scroll and select &quot;Add to Home Screen&quot;</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-full p-2 flex-shrink-0">
              <span className="text-xl">3</span>
            </div>
            <p>Tap &quot;Add&quot; in the top right corner</p>
          </div>
          
          <Button onClick={handleDismiss} className="w-full mt-4">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
