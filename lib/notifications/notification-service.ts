"use client";

import { notificationQueue } from "./notification-queue";
import { audioManager } from "./audio-manager";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: boolean;
  vibrate?: number[];
  onClick?: () => void;
  tag?: string;
}

interface NotificationServiceConfig {
  enableSound: boolean;
  soundUrl: string;
  enableVibration: boolean;
  defaultVibrationPattern: number[];
}

export class NotificationService {
  private config: NotificationServiceConfig;
  private audio?: HTMLAudioElement;
  private permissionGranted = false;

  constructor(config?: Partial<NotificationServiceConfig>) {
    this.config = {
      enableSound: true,
      soundUrl: "/notification.wav",
      enableVibration: true,
      defaultVibrationPattern: [200, 100, 200],
      ...config,
    };

    this.initializeAudio();
    this.checkPermission();
  }

  private initializeAudio() {
    if (typeof window !== "undefined" && this.config.enableSound) {
      try {
        this.audio = new Audio(this.config.soundUrl);
        this.audio.preload = "auto";
        this.audio.volume = 0.7;
      } catch (error) {
        console.warn("Failed to initialize notification audio:", error);
      }
    }
  }

  private checkPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      this.permissionGranted = Notification.permission === "granted";
      console.log("🔐 Notification service permission check:", {
        permission: Notification.permission,
        granted: this.permissionGranted,
      });
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission === "denied") {
      console.warn("❌ Notification permission was previously denied");
      console.log("💡 To enable notifications:");
      console.log("1. Click the 🔒 or ⓘ icon in the browser address bar");
      console.log("2. Change notifications from 'Block' to 'Allow'");
      console.log("3. Refresh the page and try again");
      return false;
    }

    try {
      console.log("🔔 Requesting notification permission...");
      const permission = await Notification.requestPermission();
      console.log("🔐 Permission result:", permission);

      this.permissionGranted = permission === "granted";

      // Process any queued notifications when permission is granted
      if (this.permissionGranted) {
        console.log("🔔 Permission granted, processing queued notifications");
        notificationQueue.processQueue();
      } else {
        console.log("❌ Permission denied or dismissed");
      }

      return this.permissionGranted;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  }

  private async playSound() {
    if (!this.config.enableSound) return;

    try {
      // Try the new audio manager first
      const webAudioWorked = await audioManager.playNotificationSound();
      if (webAudioWorked) {
        return;
      }

      // Fallback to HTML5 Audio
      if (this.audio) {
        this.audio.currentTime = 0;
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log("🎵 HTML5 Audio notification played successfully");
        }
      } else {
        // Last resort - try audio manager fallback
        const fallbackWorked = await audioManager.playFallbackSound();
        if (fallbackWorked) {
          console.log("🎵 Fallback audio notification played successfully");
        } else {
          console.warn("🎵 All audio methods failed");
        }
      }
    } catch (error) {
      console.warn("🎵 Failed to play notification sound:", error);

      // Try audio manager fallback as last resort
      try {
        const fallbackWorked = await audioManager.playFallbackSound();
        if (fallbackWorked) {
          console.log("🎵 Last resort fallback worked");
        }
      } catch (fallbackError) {
        console.error("🎵 All audio methods exhausted:", fallbackError);
      }
    }
  }

  private vibrate(pattern?: number[]) {
    if (!this.config.enableVibration || !navigator.vibrate) return;

    const vibrationPattern = pattern || this.config.defaultVibrationPattern;
    navigator.vibrate(vibrationPattern);
  }

  async showNotification(options: NotificationOptions): Promise<boolean> {
    // Check if we have permission
    if (!this.permissionGranted) {
      console.warn("Notification permission not granted - queuing for later");

      // Queue the notification for when permission is granted
      notificationQueue.enqueue({
        title: options.title,
        body: options.body,
        icon: options.icon,
        data: options,
      });

      return false;
    }

    // Always play sound and vibrate for immediate feedback
    if (options.sound !== false) {
      await this.playSound();
    }
    if (options.vibrate) {
      this.vibrate(options.vibrate);
    }

    // Don't show visual notification if page is visible (user is actively using the app)
    if (document.visibilityState === "visible") {
      console.log(
        "👁️ Page is visible, skipping visual notification but sound/vibration played"
      );
      return false;
    }

    try {
      // Create notification
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/icons/icon-192x192.png",
        badge: options.badge || "/icons/icon-72x72.png",
        tag: options.tag,
        requireInteraction: false,
        silent: false, // Allow system notification sounds
      });

      // Handle click
      if (options.onClick) {
        notification.onclick = () => {
          window.focus();
          options.onClick?.();
          notification.close();
        };
      }

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Play sound if enabled
      if (options.sound !== false) {
        await this.playSound();
      }

      // Vibrate if specified
      if (options.vibrate) {
        this.vibrate(options.vibrate);
      }

      return true;
    } catch (error) {
      console.error("Failed to show notification:", error);

      // Queue the notification for retry
      notificationQueue.enqueue({
        title: options.title,
        body: options.body,
        icon: options.icon,
        data: options,
      });

      return false;
    }
  }

  // Convenience method for message notifications
  async showMessageNotification(
    senderName: string,
    messageContent: string,
    onOpen?: () => void
  ): Promise<boolean> {
    return this.showNotification({
      title: "Nouveau message",
      body: `${senderName}: ${messageContent}`,
      icon: "/icons/icon-192x192.png",
      tag: "message",
      sound: true,
      vibrate: [200, 100, 200, 100, 200],
      onClick: onOpen,
    });
  }

  // Convenience method for ride notifications
  async showRideNotification(
    title: string,
    message: string,
    onOpen?: () => void
  ): Promise<boolean> {
    return this.showNotification({
      title,
      body: message,
      icon: "/icons/icon-192x192.png",
      tag: "ride",
      sound: true,
      vibrate: [300, 100, 300],
      onClick: onOpen,
    });
  }

  // Check if notifications are supported and enabled
  isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  }

  isEnabled(): boolean {
    // Always check the current browser permission state
    if (typeof window !== "undefined" && "Notification" in window) {
      const currentPermission = Notification.permission === "granted";
      if (currentPermission !== this.permissionGranted) {
        console.log("🔄 Permission state sync:", {
          was: this.permissionGranted,
          now: currentPermission,
          browserState: Notification.permission,
        });
        this.permissionGranted = currentPermission;
      }
      return currentPermission;
    }
    return false;
  }

  // Update configuration
  updateConfig(newConfig: Partial<NotificationServiceConfig>) {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize audio if sound settings changed
    if (newConfig.enableSound !== undefined || newConfig.soundUrl) {
      this.initializeAudio();
    }
  }
}

// Create a singleton instance
export const notificationService = new NotificationService();

// Hook for React components
export function useNotificationService() {
  return notificationService;
}
