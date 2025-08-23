"use client";

import { notificationService } from "./notification-service";

interface PushSubscriptionData {
  readonly endpoint: string;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
}

interface PushNotificationPayload {
  readonly title: string;
  readonly body: string;
  readonly icon?: string;
  readonly badge?: string;
  readonly tag?: string;
  readonly data?: Record<string, any>;
  readonly actions?: Array<{
    readonly action: string;
    readonly title: string;
    readonly icon?: string;
  }>;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean;

  private constructor() {
    this.isSupported = this.checkSupport();
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private checkSupport(): boolean {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  isPushSupported(): boolean {
    return this.isSupported;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      throw new Error("Push notifications are not supported in this browser");
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    if (Notification.permission === "denied") {
      return "denied";
    }

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return "denied";
    }
  }

  async subscribeToPush(userId: string): Promise<PushSubscription | null> {
    console.log("🔔 subscribeToPush called with userId:", userId);

    if (!this.isSupported) {
      console.warn("Push messaging is not supported");
      return null;
    }

    try {
      console.log("🔔 Getting service worker registration...");
      // Get service worker registration
      this.registration = await navigator.serviceWorker.ready;
      console.log(
        "🔔 Service worker registration obtained:",
        this.registration
      );

      // Check if already subscribed
      const existingSubscription =
        await this.registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log("🔔 User already subscribed to push notifications");
        return existingSubscription;
      }

      // Subscribe to push notifications
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      // Store subscription via API route (server-side)
      await this.saveSubscriptionViaAPI(userId, subscription);

      console.log("✅ Successfully subscribed to push notifications");
      return subscription;
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      return null;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription =
        await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log("🔔 Successfully unsubscribed from push notifications");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications:", error);
      return false;
    }
  }

  private async saveSubscriptionViaAPI(
    userId: string,
    subscription: PushSubscription
  ): Promise<void> {
    try {
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey("p256dh")!),
          auth: this.arrayBufferToBase64(subscription.getKey("auth")!),
        },
      };

      console.log("💾 Saving subscription via API:", {
        userId,
        endpoint: subscriptionData.endpoint.substring(0, 50) + "...",
        hasKeys: !!subscriptionData.keys.p256dh && !!subscriptionData.keys.auth,
      });

      // Use the API route instead of direct database access
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscriptionData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API Error: ${error.error || response.statusText}`);
      }

      console.log("✅ Push subscription saved via API successfully");
    } catch (error) {
      console.error("Failed to save subscription via API:", error);
      throw error;
    }
  }

  // Helper method to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): BufferSource {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray as BufferSource;
  }

  // Helper method to convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Method to show local notification (for testing)
  async showLocalNotification(
    payload: PushNotificationPayload
  ): Promise<boolean> {
    return notificationService.showNotification({
      title: payload.title,
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      onClick: payload.data?.onClick,
    });
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
