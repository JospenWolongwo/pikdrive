import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import webpush from "web-push";

// Type declaration for process.env
declare const process: {
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: string;
    VAPID_PRIVATE_KEY: string;
  };
};

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  "mailto:support@pikdrive.cm",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Helper function to check if subscription is expired
function isSubscriptionExpired(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message || "";
  const statusCode = error.statusCode;

  // Check for various expired/unsubscribed indicators
  return (
    statusCode === 410 || // Gone
    statusCode === 404 || // Not Found
    errorMessage.includes("410") ||
    errorMessage.includes("Gone") ||
    errorMessage.includes("expired") ||
    errorMessage.includes("unsubscribed") ||
    errorMessage.includes("not found") ||
    errorMessage.includes("invalid")
  );
}

// Helper function to clean up expired subscriptions
async function cleanupExpiredSubscription(
  supabase: any,
  subscription: any,
  reason: string
) {
  try {
    // Try to update with new columns, fallback to basic update if they don't exist
    const updateData: any = {
      is_active: false,
      updated_at: new Date().toISOString(),
    };

    // Only add deactivation_reason if the column exists
    try {
      updateData.deactivation_reason = reason;
    } catch (e) {
      // Column doesn't exist, skip it
    }

    // Mark subscription as inactive
    await supabase
      .from("push_subscriptions")
      .update(updateData)
      .eq("subscription", JSON.stringify(subscription));

    console.log(`🗑️ Expired subscription cleaned up: ${reason}`);
    return true;
  } catch (cleanupError) {
    console.error("Failed to cleanup expired subscription:", cleanupError);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, title, body, data, icon, badge, tag, actions } =
      await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, body" },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify user session (optional for server-side calls)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("subscription, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }); // Try newest subscriptions first

    if (error) {
      console.error("Failed to fetch subscriptions:", error);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    if (!subscriptions?.length) {
      return NextResponse.json(
        { error: "No active subscriptions found" },
        { status: 404 }
      );
    }

    let successfulSends = 0;
    const errors: string[] = [];
    const expiredSubscriptions: any[] = [];

    // Send to each subscription using web-push
    for (const { subscription } of subscriptions) {
      try {
        // Handle subscription data - it might be a string or already an object
        let subscriptionObj;
        if (typeof subscription === "string") {
          try {
            subscriptionObj = JSON.parse(subscription);
          } catch (parseError) {
            console.error("Failed to parse subscription JSON:", parseError);
            expiredSubscriptions.push({ subscription, reason: "Invalid JSON" });
            continue; // Skip this subscription
          }
        } else {
          subscriptionObj = subscription;
        }

        // Validate subscription object
        if (!subscriptionObj || !subscriptionObj.endpoint) {
          console.error("Invalid subscription object:", subscriptionObj);
          expiredSubscriptions.push({ subscription, reason: "Invalid object" });
          continue; // Skip this subscription
        }

        // Check if endpoint is still valid (basic validation)
        if (
          !subscriptionObj.endpoint.includes("fcm.googleapis.com") &&
          !subscriptionObj.endpoint.includes(
            "updates.push.services.mozilla.com"
          )
        ) {
          console.warn("Suspicious endpoint format:", subscriptionObj.endpoint);
        }

        await webpush.sendNotification(
          subscriptionObj,
          JSON.stringify({
            title,
            body,
            icon: icon || "/icons/icon-192x192.png",
            badge: badge || "/icons/badge-72x72.png",
            data,
            tag,
            actions,
            timestamp: Date.now(),
          })
        );

        successfulSends++;
        console.log(
          `✅ Push notification sent to subscription: ${subscriptionObj.endpoint.substring(
            0,
            50
          )}...`
        );

        // Update last_used timestamp for successful subscription (if column exists)
        try {
          await supabase
            .from("push_subscriptions")
            .update({ last_used: new Date().toISOString() })
            .eq("subscription", JSON.stringify(subscriptionObj));
        } catch (updateError) {
          // Column might not exist yet, this is expected before migration
          console.log(
            "ℹ️ last_used column not available yet (will be added by migration)"
          );
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(errorMsg);
        console.error("Failed to send push notification:", error);

        // Check if subscription is expired
        if (isSubscriptionExpired(error)) {
          expiredSubscriptions.push({
            subscription,
            reason: `Expired: ${errorMsg}`,
          });
        }
      }
    }

    // Clean up expired subscriptions in batch
    if (expiredSubscriptions.length > 0) {
      console.log(
        `🧹 Cleaning up ${expiredSubscriptions.length} expired subscriptions...`
      );

      for (const { subscription, reason } of expiredSubscriptions) {
        await cleanupExpiredSubscription(supabase, subscription, reason);
      }
    }

    const message =
      successfulSends > 0
        ? `Sent to ${successfulSends}/${subscriptions.length} devices`
        : "Failed to send to any devices";

    if (successfulSends > 0) {
      console.log(`📤 Push notification sent: ${message}`);
      return NextResponse.json({
        success: true,
        message,
        total: subscriptions.length,
        successful: successfulSends,
        failed: subscriptions.length - successfulSends,
        expiredCleaned: expiredSubscriptions.length,
      });
    } else {
      console.warn(`⚠️ Push notification failed: ${message}`);
      return NextResponse.json(
        {
          error: message,
          details: errors,
          expiredCleaned: expiredSubscriptions.length,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Push notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
