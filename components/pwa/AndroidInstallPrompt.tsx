'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/hooks';

export interface AndroidInstallPromptProps {
  show: boolean;
  onClose: () => void;
  onInstall: () => void;
}

export function AndroidInstallPrompt({ show, onClose, onInstall }: AndroidInstallPromptProps) {
  const { t } = useLocale();
  
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pwa.android.title")}</DialogTitle>
          <DialogDescription>
            {t("pwa.android.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>{t("pwa.android.step1")}</li>
            <li>{t("pwa.android.step2")}</li>
            <li>{t("pwa.android.step3")}</li>
            <li>{t("pwa.android.step4")}</li>
          </ul>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              {t("pwa.later")}
            </Button>
            <Button onClick={onInstall}>
              {t("pwa.installNow")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
