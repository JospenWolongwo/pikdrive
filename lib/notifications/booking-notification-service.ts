import webpush from "web-push";

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  "mailto:support@pikdrive.cm",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface BookingNotification {
  type: string;
  userId: string;
  title: string;
  body: string;
  data: Record<string, any>;
}

/**
 * Check if a subscription is expired
 */
function isSubscriptionExpired(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message || "";
  const statusCode = error.statusCode;

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

/**
 * Send push notification to a specific user
 */
export async function sendPushNotification(
  notification: BookingNotification,
  supabase: any
): Promise<void> {
  try {
    console.log("📤 Sending booking notification:", {
      type: notification.type,
      userId: notification.userId,
      title: notification.title,
    });

    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", notification.userId)
      .eq("is_active", true);

    if (error) {
      console.error("❌ Error fetching subscriptions:", error);
      return;
    }

    if (!subscriptions?.length) {
      console.log("ℹ️ No active subscriptions for user:", notification.userId);
      return;
    }

    // Send to each subscription
    const sendPromises = subscriptions.map(
      async ({ subscription }: { subscription: any }) => {
        try {
          let subscriptionObj;
          if (typeof subscription === "string") {
            subscriptionObj = JSON.parse(subscription);
          } else {
            subscriptionObj = subscription;
          }

          await webpush.sendNotification(
            subscriptionObj,
            JSON.stringify({
              title: notification.title,
              body: notification.body,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/badge-72x72.png",
              data: notification.data,
              tag: `booking-${notification.data.bookingId}`,
              actions: [
                {
                  action: "view",
                  title: "Voir",
                  icon: "/icons/icon-72x72.png",
                },
                {
                  action: "close",
                  title: "Fermer",
                  icon: "/icons/icon-72x72.png",
                },
              ],
              timestamp: Date.now(),
            })
          );

          console.log(
            "✅ Push notification sent successfully to user:",
            notification.userId
          );
        } catch (error) {
          console.error("❌ Failed to send push notification:", error);

          // Check if subscription is expired and mark as inactive
          if (isSubscriptionExpired(error)) {
            // Mark subscription as inactive
            try {
              await supabase
                .from("push_subscriptions")
                .update({
                  is_active: false,
                  updated_at: new Date().toISOString(),
                })
                .eq("subscription", JSON.stringify(subscription));

              console.log("🗑️ Marked expired subscription as inactive");
            } catch (updateError) {
              console.error(
                "❌ Failed to mark subscription inactive:",
                updateError
              );
            }
          }
        }
      }
    );

    await Promise.allSettled(sendPromises);
  } catch (error) {
    console.error("❌ Error in sendPushNotification:", error);
  }
}

/**
 * Process database notification and send push notification
 */
export async function processDatabaseNotification(
  notificationData: string,
  supabase: any
): Promise<void> {
  try {
    const notification: BookingNotification = JSON.parse(notificationData);
    await sendPushNotification(notification, supabase);
  } catch (error) {
    console.error("❌ Error processing database notification:", error);
  }
}
