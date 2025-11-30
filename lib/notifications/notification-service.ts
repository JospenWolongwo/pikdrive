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
      soundUrl: "/sounds/new-message.wav", // Using WAV files only
      enableVibration: true,
      defaultVibrationPattern: [200, 100, 200],
      ...config,
    };

    // Only initialize on the client side
    if (typeof window !== "undefined") {
      this.initializeAudio();
      this.checkPermission();
    }
  }

  private initializeAudio() {
    if (typeof window !== "undefined" && this.config.enableSound) {
      try {
        // Try to load the notification sound with fallback
        this.audio = new Audio(this.config.soundUrl);
        this.audio.preload = "auto";
        this.audio.volume = 0.7;

        // Add error handling for missing audio file
        this.audio.addEventListener("error", (e) => {
          console.warn("Notification audio file not found, using fallback:", e);
          // Try fallback sound or disable sound
          this.tryFallbackAudio();
        });

        // Test if audio can be loaded
        this.audio.addEventListener("canplaythrough", () => {
          // Audio loaded successfully
        });
      } catch (error) {
        console.warn("Failed to initialize notification audio:", error);
        this.tryFallbackAudio();
      }
    }
  }

  private tryFallbackAudio() {
    try {
      // Try alternative WAV sound files
      const fallbackSounds = [
        "/sounds/new-message.wav",
        "/sounds/announcement.wav",
        "/sounds/booking-confirmed.wav",
        "/sounds/booking-cancelled.wav",
        "/sounds/payment-success.wav",
        "/sounds/payment-failed.wav",
      ];

      for (const soundUrl of fallbackSounds) {
        if (soundUrl !== this.config.soundUrl) {
          try {
            this.audio = new Audio(soundUrl);
            this.audio.preload = "auto";
            this.audio.volume = 0.7;
            this.config.soundUrl = soundUrl;
            return;
          } catch (fallbackError) {
            continue;
          }
        }
      }

      // If no fallback works, disable sound
      console.warn("No notification audio files found, disabling sound");
      this.config.enableSound = false;
    } catch (error) {
      console.warn("Failed to initialize fallback audio:", error);
      this.config.enableSound = false;
    }
  }

  private checkPermission() {
    if (typeof window !== "undefined" && typeof Notification !== 'undefined' && "Notification" in window) {
      try {
        this.permissionGranted = Notification.permission === "granted";
      } catch (error) {
        console.warn("Error checking Notification.permission:", error);
        this.permissionGranted = false;
      }
    }
  }

  // Public method to ensure initialization on client side
  ensureInitialized() {
    if (typeof window !== "undefined") {
      this.initializeAudio();
      this.checkPermission();
    }
  }

  async requestPermission(): Promise<boolean> {
    // Check if Notification API is available (iOS Safari doesn't support it)
    if (typeof Notification === 'undefined' || !("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    // Safely check permission
    let currentPermission: NotificationPermission;
    try {
      currentPermission = Notification.permission;
    } catch (error) {
      console.warn("Error accessing Notification.permission:", error);
      return false;
    }

    if (currentPermission === "granted") {
      this.permissionGranted = true;
      return true;
    }

    if (currentPermission === "denied") {
      console.warn("❌ Notification permission was previously denied");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();

      this.permissionGranted = permission === "granted";

      // Process any queued notifications when permission is granted
      if (this.permissionGranted) {
        notificationQueue.processQueue();
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
        }
      } else {
        // Last resort - try audio manager fallback
        const fallbackWorked = await audioManager.playFallbackSound();
        if (fallbackWorked) {
          // Fallback audio played successfully
        } else {
          console.warn("🎵 All audio methods failed");
        }
      }
    } catch (error) {
      console.warn("🎵 Failed to play notification sound:", error);

      // Try audio manager fallback as last resort
      try {
        const fallbackWorked = await audioManager.playFallbackSound();
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
      // Safely check permission (iOS Safari doesn't support Notification API)
      let currentPermission = false;
      if (typeof Notification !== 'undefined' && 'Notification' in window) {
        try {
          currentPermission = Notification.permission === "granted";
        } catch (error) {
          console.warn("Error checking Notification.permission:", error);
        }
      }
      if (currentPermission !== this.permissionGranted) {
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
