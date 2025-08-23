#!/usr/bin/env node

/**
 * Push Subscription Cleanup Script
 *
 * This script helps clean up expired push subscriptions and maintain the database.
 * Run it periodically to ensure only valid subscriptions remain active.
 *
 * Usage:
 * - Development: node scripts/cleanup-push-subscriptions.js
 * - Production: Add to cron job or scheduled task
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupPushSubscriptions() {
  console.log("🧹 Starting push subscription cleanup...");

  try {
    // Get all active subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription, user_id, created_at, last_used")
      .eq("is_active", true);

    if (error) {
      console.error("❌ Failed to fetch subscriptions:", error);
      return;
    }

    if (!subscriptions?.length) {
      console.log("✅ No subscriptions to clean up");
      return;
    }

    console.log(`📱 Found ${subscriptions.length} active subscriptions`);

    let cleanedCount = 0;
    const errors = [];

    // Check each subscription
    for (const {
      id,
      subscription,
      user_id,
      created_at,
      last_used,
    } of subscriptions) {
      try {
        let subscriptionObj;

        if (typeof subscription === "string") {
          try {
            subscriptionObj = JSON.parse(subscription);
          } catch (parseError) {
            console.log(
              `🗑️ Invalid JSON for subscription ${id}, marking as inactive`
            );
            await markSubscriptionInactive(id, "Invalid JSON format");
            cleanedCount++;
            continue;
          }
        } else {
          subscriptionObj = subscription;
        }

        // Check if subscription is too old (more than 90 days)
        const createdAt = new Date(created_at);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        if (createdAt < ninetyDaysAgo) {
          console.log(
            `🗑️ Subscription ${id} is too old (${
              createdAt.toISOString().split("T")[0]
            }), marking as inactive`
          );
          await markSubscriptionInactive(id, "Subscription too old (>90 days)");
          cleanedCount++;
          continue;
        }

        // Check if subscription hasn't been used recently (more than 30 days)
        if (last_used) {
          const lastUsed = new Date(last_used);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          if (lastUsed < thirtyDaysAgo) {
            console.log(
              `🗑️ Subscription ${id} hasn't been used recently (${
                lastUsed.toISOString().split("T")[0]
              }), marking as inactive`
            );
            await markSubscriptionInactive(id, "Not used recently (>30 days)");
            cleanedCount++;
            continue;
          }
        }

        console.log(`✅ Subscription ${id} is valid`);
      } catch (error) {
        console.error(`❌ Error processing subscription ${id}:`, error);
        errors.push(`Subscription ${id}: ${error.message}`);
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
        "❌ Failed to cleanup old inactive subscriptions:",
        cleanupError
      );
    } else {
      console.log(`🧹 Cleaned up old inactive subscriptions`);
    }

    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   Total subscriptions: ${subscriptions.length}`);
    console.log(`   Cleaned up: ${cleanedCount}`);
    console.log(`   Remaining active: ${subscriptions.length - cleanedCount}`);

    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length}`);
      errors.forEach((error) => console.log(`     - ${error}`));
    }
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
}

async function markSubscriptionInactive(id, reason) {
  try {
    await supabase
      .from("push_subscriptions")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        deactivation_reason: reason,
      })
      .eq("id", id);

    return true;
  } catch (error) {
    console.error(`❌ Failed to mark subscription ${id} as inactive:`, error);
    return false;
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  cleanupPushSubscriptions()
    .then(() => {
      console.log("✅ Cleanup completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Cleanup failed:", error);
      process.exit(1);
    });
}

module.exports = { cleanupPushSubscriptions };
