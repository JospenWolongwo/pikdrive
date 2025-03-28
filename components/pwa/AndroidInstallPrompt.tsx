'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface AndroidInstallPromptProps {
  show: boolean;
  onClose: () => void;
  onInstall: () => void;
}

export function AndroidInstallPrompt({ show, onClose, onInstall }: AndroidInstallPromptProps) {
  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install PikDrive</DialogTitle>
          <DialogDescription>
            Install PikDrive on your device for the best experience:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Tap &quot;Add to Home Screen&quot; when prompted</li>
            <li>Or click &quot;Install&quot; in your browser menu</li>
            <li>Access PikDrive directly from your home screen</li>
            <li>Get a faster, app-like experience</li>
          </ul>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Later
            </Button>
            <Button onClick={onInstall}>
              Install Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
