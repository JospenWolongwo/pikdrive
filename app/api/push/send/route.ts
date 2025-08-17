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
      .select("subscription")
      .eq("user_id", userId)
      .eq("is_active", true);

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

    // Send to each subscription using web-push
    for (const { subscription } of subscriptions) {
      try {
        const subscriptionObj = JSON.parse(subscription);

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
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(errorMsg);
        console.error("Failed to send push notification:", error);

        // Mark invalid subscriptions as inactive
        if (errorMsg.includes("410") || errorMsg.includes("Gone")) {
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("subscription", subscription);
          console.log("🗑️ Invalid subscription marked as inactive");
        }
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
      });
    } else {
      console.warn(`⚠️ Push notification failed: ${message}`);
      return NextResponse.json(
        {
          error: message,
          details: errors,
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
