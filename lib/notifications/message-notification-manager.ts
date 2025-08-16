"use client";

import { SupabaseClient } from "@supabase/supabase-js";
import { notificationService } from "./notification-service";
import { audioManager } from "./audio-manager";

interface MessageNotificationConfig {
  supabase: SupabaseClient;
  userId: string;
  onMessageClick?: (rideId: string) => void;
  onNewMessage?: () => void;
}

export class MessageNotificationManager {
  private supabase: SupabaseClient;
  private userId: string;
  private onMessageClick?: (rideId: string) => void;
  private onNewMessage?: () => void;
  private globalChannel?: any;
  private isActive = false;
  private recentNotifications: Set<string> = new Set(); // Track recent notifications

  constructor(config: MessageNotificationConfig) {
    this.supabase = config.supabase;
    this.userId = config.userId;
    this.onMessageClick = config.onMessageClick;
    this.onNewMessage = config.onNewMessage;
  }

  async start() {
    if (this.isActive) {
      console.warn("MessageNotificationManager is already active");
      return;
    }

    // Ensure we're on the client side
    if (typeof window === "undefined") {
      console.warn("MessageNotificationManager cannot start on server side");
      return;
    }

    // Check notification permission status
    const permissionGranted = await notificationService.requestPermission();

    // Set up global message subscription
    this.globalChannel = this.supabase
      .channel("global-message-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${this.userId}`,
        },
        async (payload: any) => {
          await this.handleNewMessage(payload.new);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          this.isActive = true;
        }
      });
  }

  stop() {
    if (!this.isActive) return;

    if (this.globalChannel) {
      this.globalChannel.unsubscribe();
      this.globalChannel = null;
    }

    this.isActive = false;
  }

  private async handleNewMessage(message: any) {
    try {
      // Don't notify for our own messages (strict comparison)
      if (
        message.sender_id === this.userId ||
        String(message.sender_id) === String(this.userId)
      ) {
        return; // Silent return - no notification for sender
      }

      // Prevent duplicate notifications for the same message
      const messageKey = `${message.id}-${message.created_at}`;
      if (this.recentNotifications.has(messageKey)) {
        return; // Already processed this message
      }

      // Add to recent notifications (cleanup after 30 seconds)
      this.recentNotifications.add(messageKey);
      setTimeout(() => {
        this.recentNotifications.delete(messageKey);
      }, 30000);

      // Fetch sender information
      const { data: senderData, error: senderError } = await this.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", message.sender_id)
        .single();

      if (senderError) {
        console.error("❌ Error fetching sender info:", senderError);
        return;
      }

      const senderName = senderData?.full_name || "Unknown User";

      // FIRST: Play sound immediately (before anything else can fail)
      try {
        // Direct call to audio manager for immediate sound
        const audioWorked = await audioManager.playNotificationSound();
        if (!audioWorked) {
          await audioManager.playFallbackSound();
        }
      } catch (error) {
        // Audio failed silently
      }

      // Always vibrate if supported (for immediate feedback)
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      // THEN: Show notification (this may or may not work, but sound already played)
      const notificationShown =
        await notificationService.showMessageNotification(
          senderName,
          message.content,
          () => {
            // Handle notification click
            if (this.onMessageClick) {
              this.onMessageClick(message.ride_id);
            }
          }
        );

      // Notification shown silently

      // Call the new message callback to refresh conversations
      if (this.onNewMessage) {
        this.onNewMessage();
      }
    } catch (error) {
      console.error("❌ Error handling new message notification:", error);
    }
  }

  // Update configuration
  updateConfig(config: Partial<MessageNotificationConfig>) {
    if (config.userId && config.userId !== this.userId) {
      // User changed, restart the manager
      this.stop();
      this.userId = config.userId;
      if (config.supabase) this.supabase = config.supabase;
      if (config.onMessageClick) this.onMessageClick = config.onMessageClick;
      if (config.onNewMessage) this.onNewMessage = config.onNewMessage;
      this.start();
    } else {
      // Just update the callbacks
      if (config.onMessageClick) this.onMessageClick = config.onMessageClick;
      if (config.onNewMessage) this.onNewMessage = config.onNewMessage;
      if (config.supabase) this.supabase = config.supabase;
    }
  }

  isRunning(): boolean {
    return this.isActive;
  }
}

// Singleton instance
let globalMessageNotificationManager: MessageNotificationManager | null = null;

export function getGlobalMessageNotificationManager(): MessageNotificationManager | null {
  return globalMessageNotificationManager;
}

export function initializeGlobalMessageNotificationManager(
  config: MessageNotificationConfig
): MessageNotificationManager {
  // Clean up existing manager if any
  if (globalMessageNotificationManager) {
    globalMessageNotificationManager.stop();
  }

  globalMessageNotificationManager = new MessageNotificationManager(config);
  return globalMessageNotificationManager;
}

export function cleanupGlobalMessageNotificationManager() {
  if (globalMessageNotificationManager) {
    globalMessageNotificationManager.stop();
    globalMessageNotificationManager = null;
  }
}
