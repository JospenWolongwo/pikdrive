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
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify admin session (optional for server-side calls)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription, user_id, created_at, last_used")
      .eq("is_active", true);

    if (error) {
      console.error("Failed to fetch subscriptions:", error);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    if (!subscriptions?.length) {
      return NextResponse.json({
        success: true,
        message: "No subscriptions to clean up",
        total: 0,
        cleaned: 0,
      });
    }

    let cleanedCount = 0;
    const errors: string[] = [];

    // Test each subscription
    for (const { id, subscription } of subscriptions) {
      try {
        let subscriptionObj;
        if (typeof subscription === "string") {
          try {
            subscriptionObj = JSON.parse(subscription);
          } catch (parseError) {
            // Mark as inactive if JSON is invalid
            await supabase
              .from("push_subscriptions")
              .update({
                is_active: false,
                updated_at: new Date().toISOString(),
                deactivation_reason: "Invalid JSON format",
              })
              .eq("id", id);
            cleanedCount++;
            continue;
          }
        } else {
          subscriptionObj = subscription;
        }

        // Send a test notification to check if subscription is still valid
        await webpush.sendNotification(
          subscriptionObj,
          JSON.stringify({
            title: "Test",
            body: "Testing subscription validity",
            timestamp: Date.now(),
          })
        );

        // If we get here, subscription is still valid
        console.log(`✅ Subscription ${id} is valid`);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";

        // Check if subscription is expired
        if (
          errorMsg.includes("410") ||
          errorMsg.includes("Gone") ||
          errorMsg.includes("expired") ||
          errorMsg.includes("unsubscribed") ||
          errorMsg.includes("not found")
        ) {
          // Mark subscription as inactive
          await supabase
            .from("push_subscriptions")
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
              deactivation_reason: `Expired: ${errorMsg}`,
            })
            .eq("id", id);

          cleanedCount++;
          console.log(`🗑️ Expired subscription ${id} cleaned up`);
        } else {
          errors.push(`Subscription ${id}: ${errorMsg}`);
        }
      }
    }

    // Clean up old inactive subscriptions (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: oldInactive, error: cleanupError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("is_active", false)
      .lt("updated_at", thirtyDaysAgo.toISOString());

    if (cleanupError) {
      console.error(
        "Failed to cleanup old inactive subscriptions:",
        cleanupError
      );
    } else {
      console.log(`🧹 Cleaned up old inactive subscriptions`);
    }

    const message = `Cleaned up ${cleanedCount}/${subscriptions.length} expired subscriptions`;

    console.log(`📤 Subscription cleanup completed: ${message}`);
    return NextResponse.json({
      success: true,
      message,
      total: subscriptions.length,
      cleaned: cleanedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Subscription cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup subscriptions" },
      { status: 500 }
    );
  }
}
