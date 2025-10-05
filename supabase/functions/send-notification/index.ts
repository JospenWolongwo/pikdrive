// Supabase Edge Function for sending notifications via OneSignal
// Professional, scalable, multi-platform notification system

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.5";

// Environment variables
const NEXT_PUBLIC_ONESIGNAL_APP_ID = Deno.env.get("NEXT_PUBLIC_ONESIGNAL_APP_ID")!;
const NEXT_PUBLIC_ONESIGNAL_API_KEY = Deno.env.get("NEXT_PUBLIC_ONESIGNAL_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")!;

interface NotificationRequest {
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly data?: Record<string, any>;
  readonly notificationType?: string;
  readonly imageUrl?: string;
}

interface OneSignalResponse {
  readonly id: string;
  readonly recipients: number;
  readonly errors?: any;
}

/**
 * Send notification via OneSignal
 */
async function sendViaOneSignal(
  request: NotificationRequest
): Promise<OneSignalResponse> {
  const response = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${NEXT_PUBLIC_ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: NEXT_PUBLIC_ONESIGNAL_APP_ID,
      include_external_user_ids: [request.userId],
      contents: { en: request.message, fr: request.message },
      headings: { en: request.title, fr: request.title },
      data: {
        ...request.data,
        notificationType: request.notificationType || "general",
        timestamp: Date.now(),
      },
      // iOS specific
      ios_badgeType: "Increase",
      ios_badgeCount: 1,
      ios_sound: "notification.wav",
      // Android specific
      android_channel_id: "pikdrive_notifications",
      android_sound: "notification",
      small_icon: "ic_notification",
      large_icon: request.imageUrl || "ic_launcher",
      // Web specific
      web_push_topic: request.notificationType || "general",
      chrome_web_icon: request.imageUrl || "/icons/icon-192x192.png",
      chrome_web_badge: "/icons/badge-72x72.png",
      // Delivery
      priority: 10,
      ttl: 86400, // 24 hours
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OneSignal API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
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
    // Validate request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const notificationRequest: NotificationRequest = await req.json();

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

    // Send notification via OneSignal
    const oneSignalResponse = await sendViaOneSignal(notificationRequest);

    console.log("✅ Notification sent:", {
      id: oneSignalResponse.id,
      recipients: oneSignalResponse.recipients,
    });

    // Log notification to database
    const supabase = createClient(SUPABASE_URL, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
    await logNotification(
      supabase,
      notificationRequest,
      oneSignalResponse.id,
      oneSignalResponse.recipients
    );

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        notificationId: oneSignalResponse.id,
        recipients: oneSignalResponse.recipients,
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
