"use client";

interface QueuedNotification {
  id: string;
  timestamp: number;
  title: string;
  body: string;
  icon?: string;
  data?: any;
  retryCount: number;
}

const STORAGE_KEY = "pickdrive_notification_queue";
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 5000; // 5 seconds

export class NotificationQueue {
  private queue: QueuedNotification[] = [];
  private processing = false;

  constructor() {
    this.loadQueue();
    this.startPeriodicProcessing();
  }

  private loadQueue() {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`📋 Loaded ${this.queue.length} queued notifications`);
      }
    } catch (error) {
      console.error("Failed to load notification queue:", error);
    }
  }

  private saveQueue() {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("Failed to save notification queue:", error);
    }
  }

  private startPeriodicProcessing() {
    // Process queue every 10 seconds
    setInterval(() => {
      this.processQueue();
    }, 10000);

    // Also process when page becomes visible
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.processQueue();
      }
    });
  }

  enqueue(
    notification: Omit<QueuedNotification, "id" | "timestamp" | "retryCount">
  ) {
    const queuedNotification: QueuedNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(queuedNotification);
    this.saveQueue();

    console.log("📨 Notification queued:", queuedNotification.title);

    // Try to process immediately
    this.processQueue();
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    try {
      // Check if notifications are available
      if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        console.log("🚫 Notifications not available, keeping queue");
        return;
      }

      // Process notifications that are ready for retry
      const now = Date.now();
      const readyNotifications = this.queue.filter(
        (n) => now - n.timestamp >= n.retryCount * RETRY_DELAY
      );

      for (const notification of readyNotifications) {
        try {
          // Show the notification
          const browserNotification = new Notification(notification.title, {
            body: notification.body,
            icon: notification.icon || "/icons/icon-192x192.png",
            tag: notification.id,
            requireInteraction: false,
            silent: false,
          });

          // Auto close after 5 seconds
          setTimeout(() => {
            browserNotification.close();
          }, 5000);

          // Remove from queue on success
          this.queue = this.queue.filter((n) => n.id !== notification.id);
          console.log("✅ Queued notification shown:", notification.title);
        } catch (error) {
          console.error("Failed to show queued notification:", error);

          // Increment retry count
          notification.retryCount++;

          // Remove if max retries exceeded
          if (notification.retryCount >= MAX_RETRY_COUNT) {
            this.queue = this.queue.filter((n) => n.id !== notification.id);
            console.log(
              "❌ Notification removed after max retries:",
              notification.title
            );
          }
        }
      }

      // Clean up old notifications (older than 1 hour)
      const oneHourAgo = now - 60 * 60 * 1000;
      this.queue = this.queue.filter((n) => n.timestamp > oneHourAgo);

      this.saveQueue();
    } finally {
      this.processing = false;
    }
  }

  // Get queue status for debugging
  getQueueStatus() {
    return {
      count: this.queue.length,
      notifications: this.queue.map((n) => ({
        title: n.title,
        timestamp: new Date(n.timestamp).toISOString(),
        retryCount: n.retryCount,
      })),
    };
  }

  // Clear the queue
  clear() {
    this.queue = [];
    this.saveQueue();
    console.log("🗑️ Notification queue cleared");
  }
}

// Singleton instance
export const notificationQueue = new NotificationQueue();
