'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare, Bell, CheckCircle, X } from 'lucide-react';
import { useNotificationPermission } from '@/hooks/notifications/useNotificationPermission';
import { detectDevice, getNotificationSupportMessage } from '@/lib/utils/device-detection';

interface NotificationPromptProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onEnable: () => void;
}

/**
 * Custom marketing-focused notification permission prompt
 * Designed to encourage users to enable notifications with clear benefits
 */
export function NotificationPrompt({ isOpen, onClose, onEnable }: NotificationPromptProps) {
  const { requestPermission, isLoading } = useNotificationPermission();
  const [deviceInfo] = useState(() => detectDevice());

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      onEnable();
    }
    onClose();
  };

  const handleLater = () => {
    onClose();
  };

  const supportMessage = getNotificationSupportMessage(deviceInfo);
  const canEnable = deviceInfo.supportsWebPush;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-[#28C496]">
              🔔 Activez les notifications
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-base">
            Ne manquez jamais les mises à jour importantes de vos trajets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <MessageSquare className="h-5 w-5 text-[#28C496] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Messages en temps réel</p>
                <p className="text-xs text-muted-foreground">
                  Recevez instantanément les messages de votre conducteur ou passager
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Bell className="h-5 w-5 text-[#28C496] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Mises à jour de trajet</p>
                <p className="text-xs text-muted-foreground">
                  Soyez informé des changements de statut de votre réservation
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-[#28C496] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Confirmations de paiement</p>
                <p className="text-xs text-muted-foreground">
                  Recevez immédiatement la confirmation de vos paiements
                </p>
              </div>
            </div>
          </div>

          {/* Device compatibility message */}
          {!canEnable && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                {supportMessage}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex space-x-3 pt-2">
            <Button
              onClick={handleLater}
              variant="outline"
              className="flex-1"
            >
              Plus tard
            </Button>
            <Button
              onClick={handleEnableNotifications}
              disabled={!canEnable || isLoading}
              className="flex-1 bg-[#28C496] hover:bg-[#22a085]"
            >
              {isLoading ? 'Activation...' : 'Activer les notifications'}
            </Button>
          </div>

          {/* Privacy note */}
          <p className="text-xs text-muted-foreground text-center">
            Nous respectons votre vie privée. Vous pouvez désactiver les notifications à tout moment.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
