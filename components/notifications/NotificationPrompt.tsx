'use client';

import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { MessageSquare, Bell, CheckCircle, X } from 'lucide-react';
import { useNotificationPermission } from "@/hooks/notifications";
import { detectDevice, getNotificationSupportMessage } from '@/lib/utils/device-detection';
import { useLocale } from '@/hooks';

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
  const { t } = useLocale();
  const [deviceInfo] = useState(() => detectDevice());
  const [error, setError] = useState<string | null>(null);
  
  // Check if permission was denied - show instructions instead (safely for iOS)
  const isPermissionDenied = (() => {
    if (typeof window === 'undefined') return false;
    if (typeof Notification === 'undefined' || !('Notification' in window)) return false;
    try {
      return Notification.permission === 'denied';
    } catch (error) {
      console.warn('Error checking Notification.permission:', error);
      return false;
    }
  })();

  const handleEnableNotifications = async () => {
    setError(null);
    
    try {
      // Add timeout to prevent stuck state
      const granted = await Promise.race([
        requestPermission(),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);
      
      if (granted) {
        onEnable();
        onClose(); // Only close on success
      } else {
        setError(t("notifications.prompt.permissionDenied"));
      }
    } catch (error) {
      setError(t("notifications.prompt.errorOccurred"));
      console.error('Permission request failed:', error);
    }
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
            <DialogTitle className="text-xl font-bold text-brand">
              {isPermissionDenied ? t("notifications.prompt.titleBlocked") : t("notifications.prompt.titleEnable")}
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
            {isPermissionDenied 
              ? t("notifications.prompt.descriptionBlocked")
              : t("notifications.prompt.descriptionEnable")
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show instructions when permission is denied */}
          {isPermissionDenied && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-800 mb-2">
                📍 {t("notifications.prompt.howToReenable")}
              </p>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>{t("notifications.prompt.step1")}</li>
                <li>{t("notifications.prompt.step2")}</li>
                <li>{t("notifications.prompt.step3")}</li>
                <li>{t("notifications.prompt.step4")}</li>
              </ol>
            </div>
          )}
          {/* Benefits - Only show if permission is not denied */}
          {!isPermissionDenied && (
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <MessageSquare className="h-5 w-5 text-brand mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{t("notifications.prompt.benefits.realtimeMessages.title")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("notifications.prompt.benefits.realtimeMessages.description")}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Bell className="h-5 w-5 text-brand mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{t("notifications.prompt.benefits.rideUpdates.title")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("notifications.prompt.benefits.rideUpdates.description")}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-brand mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{t("notifications.prompt.benefits.paymentConfirmations.title")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("notifications.prompt.benefits.paymentConfirmations.description")}
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Device compatibility message */}
          {!canEnable && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                {supportMessage}
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                {error}
              </p>
              {(() => {
                if (typeof window === 'undefined') return false;
                if (typeof Notification === 'undefined' || !('Notification' in window)) return false;
                try {
                  return Notification.permission === 'denied';
                } catch {
                  return false;
                }
              })() && (
                <p className="text-xs text-red-700 mt-2">
                  💡 {t("notifications.prompt.howToReenable")}<br />
                  {t("notifications.prompt.step1")} → {t("notifications.prompt.step2")} → {t("notifications.prompt.step3")}
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex space-x-3 pt-2">
            {isPermissionDenied ? (
              // Show help button when permission is denied
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                {t("notifications.prompt.understood")}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleLater}
                  variant="outline"
                  className="flex-1"
                >
                  {t("notifications.prompt.later")}
                </Button>
                <Button
                  onClick={handleEnableNotifications}
                  disabled={!canEnable || isLoading}
                  className="flex-1 bg-brand hover:bg-brand-hover"
                >
                  {isLoading ? t("notifications.prompt.activating") : t("notifications.prompt.enableNotifications")}
                </Button>
              </>
            )}
          </div>

          {/* Privacy note */}
          <p className="text-xs text-muted-foreground text-center">
            {t("notifications.prompt.privacyNote")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
