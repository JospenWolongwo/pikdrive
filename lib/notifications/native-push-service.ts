"use server";

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

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

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; message: string; sent: number; total: number }> {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get user's active push subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      console.error("Failed to fetch subscriptions:", error);
      return { success: false, message: "Database error", sent: 0, total: 0 };
    }

    if (!subscriptions?.length) {
      return {
        success: true,
        message: "No active subscriptions",
        sent: 0,
        total: 0,
      };
    }

    let successfulSends = 0;
    const errors: string[] = [];

    // Send to each subscription
    for (const { subscription } of subscriptions) {
      try {
        const success = await sendToSubscription(subscription, payload);
        if (success) {
          successfulSends++;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(errorMsg);

        // Mark invalid subscriptions as inactive
        if (errorMsg.includes("410") || errorMsg.includes("Gone")) {
          await markSubscriptionInactive(subscription);
        }
      }
    }

    const message =
      successfulSends > 0
        ? `Sent to ${successfulSends}/${subscriptions.length} devices`
        : "Failed to send to any devices";

    return {
      success: successfulSends > 0,
      message,
      sent: successfulSends,
      total: subscriptions.length,
    };
  } catch (error) {
    console.error("Push notification error:", error);
    return {
      success: false,
      message: "Internal server error",
      sent: 0,
      total: 0,
    };
  }
}

/**
 * Send notification to a specific subscription
 */
async function sendToSubscription(
  subscription: any,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    const subscriptionData = JSON.parse(subscription as string);

    // Prepare the notification data
    const notificationData = {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/badge-72x72.png",
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions,
      timestamp: Date.now(),
    };

    // Use native fetch to send the push notification
    const response = await fetch(subscriptionData.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        TTL: "86400", // 24 hours
        Urgency: "high",
        Authorization: `vapid t=${generateVAPIDToken(
          subscriptionData.endpoint
        )}`,
      },
      body: JSON.stringify(notificationData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to send to subscription:", error);
    return false;
  }
}

/**
 * Generate VAPID token for authentication
 */
function generateVAPIDToken(endpoint: string): string {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

  // This is a simplified VAPID token generation
  // In production, you'd want to use proper JWT signing
  const header = {
    alg: "ES256",
    typ: "JWT",
    kid: vapidPublicKey,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: new URL(endpoint).origin,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: "mailto:support@pikdrive.cm",
  };

  // For now, return a simple token
  // In production, implement proper JWT signing
  return (
    btoa(JSON.stringify(header)) +
    "." +
    btoa(JSON.stringify(payload)) +
    ".signature"
  );
}

/**
 * Mark subscription as inactive
 */
async function markSubscriptionInactive(subscription: any): Promise<void> {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    await supabase
      .from("push_subscriptions")
      .update({ is_active: false })
      .eq("subscription", subscription);

    console.log("🗑️ Invalid subscription marked as inactive");
  } catch (error) {
    console.error("Failed to mark subscription inactive:", error);
  }
}

/**
 * Send message notification
 */
export async function sendMessageNotification(
  userId: string,
  senderName: string,
  messageContent: string,
  messageId: string,
  rideId: string
): Promise<{ success: boolean; message: string }> {
  return sendPushNotification(userId, {
    title: "Nouveau message",
    body: `${senderName}: ${messageContent}`,
    data: {
      messageId,
      rideId,
      type: "message",
    },
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `message-${messageId}`,
    actions: [
      {
        action: "open",
        title: "Ouvrir",
        icon: "/icons/icon-72x72.png",
      },
      {
        action: "close",
        title: "Fermer",
        icon: "/icons/icon-72x72.png",
      },
    ],
  });
}

/**
 * Send payment notification
 */
export async function sendPaymentNotification(
  userId: string,
  amount: number,
  provider: string,
  status: "success" | "failed" | "pending"
): Promise<{ success: boolean; message: string }> {
  const statusText = {
    success: "réussi",
    failed: "échoué",
    pending: "en attente",
  };

  return sendPushNotification(userId, {
    title: `Paiement ${statusText[status]}`,
    body: `${amount} FCFA via ${provider}`,
    data: {
      type: "payment",
      amount,
      provider,
      status,
    },
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: `payment-${Date.now()}`,
    actions: [
      {
        action: "open",
        title: "Voir détails",
        icon: "/icons/icon-72x72.png",
      },
    ],
  });
}
