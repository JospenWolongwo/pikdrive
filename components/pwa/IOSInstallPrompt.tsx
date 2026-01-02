'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from '@/hooks';
import Image from 'next/image';

export interface IOSInstallPromptProps {
  show: boolean;
  onClose: () => void;
}

export function IOSInstallPrompt({ show, onClose }: IOSInstallPromptProps) {
  const { t } = useLocale();
  
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
          <DialogTitle>{t("pwa.ios.title")}</DialogTitle>
          <DialogDescription>
            {t("pwa.ios.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-full p-2 flex-shrink-0">
              <span className="text-xl">1</span>
            </div>
            <p>{t("pwa.ios.step1")} <Image src="/images/share-ios.png" alt="iOS Share button" width={20} height={20} className="inline-block" /></p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-full p-2 flex-shrink-0">
              <span className="text-xl">2</span>
            </div>
            <p>{t("pwa.ios.step2")}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-full p-2 flex-shrink-0">
              <span className="text-xl">3</span>
            </div>
            <p>{t("pwa.ios.step3")}</p>
          </div>
          
          <Button onClick={handleDismiss} className="w-full mt-4">
            {t("pwa.ios.gotIt")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
