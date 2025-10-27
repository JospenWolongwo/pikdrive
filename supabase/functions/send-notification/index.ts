// Supabase Edge Function for sending notifications via OneSignal
// Professional, scalable, multi-platform notification system

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.5";

// Environment variables
const NEXT_PUBLIC_ONESIGNAL_APP_ID = Deno.env.get("NEXT_PUBLIC_ONESIGNAL_APP_ID")!;
const NEXT_PUBLIC_ONESIGNAL_API_KEY = Deno.env.get("NEXT_PUBLIC_ONESIGNAL_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface NotificationRequest {
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly data?: Record<string, any>;
  readonly notificationType?: string;
  readonly imageUrl?: string;
  readonly phoneNumber?: string; // For SMS notifications
  readonly sendSMS?: boolean; // Flag to enable SMS
}

interface OneSignalResponse {
  readonly id: string;
  readonly recipients: number;
  readonly errors?: any;
}

/**
 * Send SMS via OneSignal
 */
async function sendSMSViaOneSignal(
  request: NotificationRequest
): Promise<OneSignalResponse> {
  if (!request.phoneNumber) {
    throw new Error('Phone number is required for SMS');
  }

  const response = await fetch("https://onesignal.com/api/v2/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NEXT_PUBLIC_ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: NEXT_PUBLIC_ONESIGNAL_APP_ID,
      include_phone_numbers: [request.phoneNumber],
      contents: { fr: request.message, en: request.message },
      headings: { fr: request.title, en: request.title },
      data: {
        ...request.data,
        notificationType: request.notificationType || "general",
        timestamp: Date.now(),
        channel: "sms"
      },
      // SMS specific settings
      priority: 10,
      ttl: 86400, // 24 hours
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OneSignal SMS API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Send push notification via OneSignal
 */
async function sendPushViaOneSignal(
  request: NotificationRequest
): Promise<OneSignalResponse> {
  // Determine sound based on notification type
  const soundMap: Record<string, string> = {
    'payment_success': 'payment-success.wav',
    'payment_failed': 'payment-failed.wav',
    'payment_pending': 'notification.wav',
    'payment_processing': 'notification.wav',
    'booking_confirmed': 'booking-confirmed.wav',
    'booking_cancelled': 'booking-cancelled.wav',
    'new_message': 'new-message.wav',
    'general': 'announcement.wav',
  };

  const sound = soundMap[request.notificationType || 'general'] || 'notification.wav';
  const webAppUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://pikdrive.com";
  // Use app icon - Lucide icons are rendered on the frontend
  const iconUrl = `${webAppUrl}/icons/icon-192x192.png`;

  const requestBody = {
    app_id: NEXT_PUBLIC_ONESIGNAL_APP_ID,
    include_external_user_ids: [request.userId],
    contents: { fr: request.message, en: request.message },
    headings: { fr: request.title, en: request.title },
    data: {
      ...request.data,
      notificationType: request.notificationType || "general",
      timestamp: Date.now(),
    },
    // iOS specific
    ios_badgeType: "Increase",
    ios_badgeCount: 1,
    ios_sound: sound,
    // Android specific
    android_channel_id: "pikdrive_notifications",
    android_sound: sound.replace('.wav', ''),
    small_icon: "ic_notification",
    large_icon: iconUrl,
    // Web specific
    web_push_topic: request.notificationType || "general",
    chrome_web_icon: iconUrl,
    chrome_web_badge: `${webAppUrl}/icons/badge-72x72.png`,
    // Delivery
    priority: 10,
    ttl: 86400, // 24 hours
  };

  console.log("📤 Sending to OneSignal API:", {
    app_id: NEXT_PUBLIC_ONESIGNAL_APP_ID,
    external_user_ids: [request.userId],
    title: request.title,
    message: request.message.substring(0, 50),
  });

  const response = await fetch("https://onesignal.com/api/v2/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NEXT_PUBLIC_ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  console.log("📡 OneSignal API response status:", response.status);
  console.log("📡 OneSignal API response headers:", Object.fromEntries(response.headers.entries()));

  const responseText = await response.text();
  console.log("📡 OneSignal API response (first 500 chars):", responseText.substring(0, 500));

  if (!response.ok) {
    try {
      const error = JSON.parse(responseText);
      throw new Error(`OneSignal API error: ${JSON.stringify(error)}`);
    } catch (e) {
      throw new Error(`OneSignal API returned HTML error: ${responseText.substring(0, 200)}`);
    }
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error("❌ Failed to parse OneSignal response:", e);
    throw new Error(`OneSignal returned invalid JSON: ${responseText.substring(0, 200)}`);
  }
}

/**
 * Log notification to database for analytics
 */
async function logNotification(
  supabase: any,
  request: NotificationRequest,
  oneSignalId: string,
  recipients: number
): Promise<void> {
  try {
    await supabase.from("notification_logs").insert({
      user_id: request.userId,
      title: request.title,
      message: request.message,
      notification_type: request.notificationType || "general",
      onesignal_id: oneSignalId,
      recipients,
      data: request.data,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error("Failed to log notification:", error);
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body first to validate
    const notificationRequest: NotificationRequest = await req.json();
    
    console.log("📤 Received notification request:", {
      userId: notificationRequest.userId,
      title: notificationRequest.title,
      type: notificationRequest.notificationType,
    });

    // Validate required fields
    if (
      !notificationRequest.userId ||
      !notificationRequest.title ||
      !notificationRequest.message
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: userId, title, message",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("📤 Sending notification:", {
      userId: notificationRequest.userId,
      title: notificationRequest.title,
      type: notificationRequest.notificationType,
    });

    // Send notifications via OneSignal
    const results = [];
    
    // Send push notification
    try {
      const pushResponse = await sendPushViaOneSignal(notificationRequest);
      results.push({
        type: 'push',
        id: pushResponse.id,
        recipients: pushResponse.recipients
      });
      console.log("✅ Push notification sent:", pushResponse);
    } catch (error) {
      console.error("❌ Push notification failed:", error);
      results.push({ type: 'push', error: error.message });
    }

    // Send SMS if requested and phone number provided
    if (notificationRequest.sendSMS && notificationRequest.phoneNumber) {
      try {
        const smsResponse = await sendSMSViaOneSignal(notificationRequest);
        results.push({
          type: 'sms',
          id: smsResponse.id,
          recipients: smsResponse.recipients
        });
        console.log("✅ SMS sent:", smsResponse);
      } catch (error) {
        console.error("❌ SMS failed:", error);
        results.push({ type: 'sms', error: error.message });
      }
    }

    // Log notifications to database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    for (const result of results) {
      if (result.id) {
        await logNotification(
          supabase,
          notificationRequest,
          result.id,
          result.recipients
        );
      }
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        results: results,
        pushNotification: results.find(r => r.type === 'push'),
        smsNotification: results.find(r => r.type === 'sms'),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error sending notification:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
