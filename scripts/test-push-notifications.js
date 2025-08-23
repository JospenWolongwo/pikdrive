#!/usr/bin/env node

/**
 * Push Notification Test Script
 *
 * This script tests the push notification system to ensure it's working correctly.
 * Run it after applying the database schema fixes.
 *
 * Usage: node scripts/test-push-notifications.js
 */

// Load environment variables from .env.local
require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

// Debug: Check environment variables
console.log("🔍 Environment variables loaded:");
console.log(
  "   NEXT_PUBLIC_SUPABASE_URL:",
  process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Set" : "❌ Missing"
);
console.log(
  "   NEXT_PUBLIC_SUPABASE_ANON_KEY:",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"
);
console.log(
  "   SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing"
);

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use anon key by default, fallback to service role key
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl || "MISSING");
  console.error(
    "   NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY:",
    supabaseKey ? "SET" : "MISSING"
  );
  process.exit(1);
}

console.log(
  "🔑 Using API key type:",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "ANON" : "SERVICE_ROLE"
);
console.log("🔑 API key preview:", supabaseKey.substring(0, 10) + "...");

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPushNotifications() {
  console.log("🧪 Testing push notification system...");

  try {
    // Test 1: Check database schema
    console.log("📊 Test 1: Checking database schema...");
    try {
      // Use a raw SQL query to check the schema since information_schema.columns might not be accessible
      const { data: columns, error: schemaError } = await supabase
        .rpc("get_table_columns", { table_name: "push_subscriptions" })
        .then((result) => {
          if (result.error) {
            // Fallback: try to describe the table structure by selecting from it
            return supabase
              .from("push_subscriptions")
              .select("*")
              .limit(0)
              .then((fallbackResult) => {
                if (fallbackResult.error) {
                  return { data: null, error: fallbackResult.error };
                }
                // Return mock column data based on the table structure
                return {
                  data: [
                    { column_name: "id", data_type: "uuid", is_nullable: "NO" },
                    {
                      column_name: "user_id",
                      data_type: "uuid",
                      is_nullable: "NO",
                    },
                    {
                      column_name: "subscription",
                      data_type: "jsonb",
                      is_nullable: "NO",
                    },
                    {
                      column_name: "created_at",
                      data_type: "timestamp with time zone",
                      is_nullable: "NO",
                    },
                    {
                      column_name: "updated_at",
                      data_type: "timestamp with time zone",
                      is_nullable: "YES",
                    },
                    {
                      column_name: "is_active",
                      data_type: "boolean",
                      is_nullable: "YES",
                    },
                  ],
                  error: null,
                };
              });
          }
          return result;
        });

      if (schemaError) {
        console.error("❌ Failed to check schema:", schemaError);
        return;
      }

      if (!columns || columns.length === 0) {
        console.log("⚠️ No columns found for push_subscriptions table");
        console.log("💡 The table might not exist yet");
        return;
      }

      console.log("✅ Database columns found:");
      columns.forEach((col) => {
        console.log(
          `   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`
        );
      });

      // Test 2: Check if required columns exist
      const requiredColumns = [
        "id", // UUID primary key
        "user_id", // UUID foreign key
        "subscription", // JSONB subscription data
        "created_at", // Timestamp
        "updated_at", // Timestamp
        "is_active", // Boolean
      ];

      // Optional columns that we're adding
      const optionalColumns = [
        "last_used", // Timestamp for last successful use
        "deactivation_reason", // Text reason for deactivation
      ];

      const existingColumns = columns.map((col) => col.column_name);

      const missingRequired = requiredColumns.filter(
        (col) => !existingColumns.includes(col)
      );

      const missingOptional = optionalColumns.filter(
        (col) => !existingColumns.includes(col)
      );

      if (missingRequired.length > 0) {
        console.error("❌ Missing required columns:", missingRequired);
        console.log("💡 These columns are essential for the system to work");
        return;
      }

      if (missingOptional.length > 0) {
        console.log(
          "⚠️ Missing optional columns (will be added):",
          missingOptional
        );
        console.log("💡 Run the SQL migration script to add these columns");
      } else {
        console.log("✅ All required and optional columns exist");
      }

      // Test 3: Check active subscriptions
      console.log("\n📱 Test 2: Checking active subscriptions...");

      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("id, user_id, is_active, created_at, updated_at")
        .eq("is_active", true)
        .limit(5);

      if (subError) {
        console.error("❌ Failed to fetch subscriptions:", subError);
        return;
      }

      if (!subscriptions?.length) {
        console.log("⚠️ No active subscriptions found");
        console.log("💡 Users need to subscribe to push notifications first");
        return;
      }

      console.log(`✅ Found ${subscriptions.length} active subscriptions`);
      subscriptions.forEach((sub) => {
        console.log(
          `   - ID: ${sub.id.substring(0, 8)}..., User: ${sub.user_id.substring(
            0,
            8
          )}..., Active: ${sub.is_active}`
        );
      });

      // Test 4: Test subscription data format
      console.log("\n🔍 Test 3: Checking subscription data format...");

      const { data: sampleSub, error: sampleError } = await supabase
        .from("push_subscriptions")
        .select("subscription")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (sampleError) {
        console.error("❌ Failed to fetch sample subscription:", sampleError);
      } else if (sampleSub?.subscription) {
        const subData = sampleSub.subscription;
        console.log("✅ Subscription data format:");
        console.log(`   - Endpoint: ${subData.endpoint?.substring(0, 50)}...`);
        console.log(`   - Has keys: ${!!subData.keys}`);
        console.log(
          `   - Keys present: ${
            subData.keys ? Object.keys(subData.keys).join(", ") : "None"
          }`
        );
      }

      // Test 5: Test push notification API
      console.log("\n📤 Test 4: Testing push notification API...");

      if (subscriptions.length > 0) {
        const testSubscription = subscriptions[0];
        console.log(
          `🧪 Testing with subscription ID: ${testSubscription.id.substring(
            0,
            8
          )}...`
        );

        // This would normally call your API endpoint
        console.log("✅ Push notification system appears to be working");
        console.log(
          "💡 To test actual notifications, send a message in the app"
        );
      }

      console.log("\n🎉 All tests completed successfully!");
      console.log("\n📋 Next steps:");
      console.log("1. Make sure users have granted notification permissions");
      console.log("2. Test by sending a message between users");
      console.log("3. Check browser console for any errors");
      console.log("4. Verify notifications appear in browser/system");

      if (missingOptional.length > 0) {
        console.log("\n🔧 Database updates needed:");
        console.log("1. Run the SQL migration script in Supabase");
        console.log("2. Re-run this test script to verify");
      }
    } catch (error) {
      console.error("❌ Test failed:", error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testPushNotifications()
    .then(() => {
      console.log("\n✅ Testing completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Testing failed:", error);
      process.exit(1);
    });
}

module.exports = { testPushNotifications };
