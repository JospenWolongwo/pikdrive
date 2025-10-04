import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { processDatabaseNotification } from "@/lib/notifications/booking-notification-service";

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    // Verify user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationData } = await request.json();

    if (!notificationData) {
      return NextResponse.json(
        { error: "Missing notification data" },
        { status: 400 }
      );
    }

    // Process the notification and send push notification
    await processDatabaseNotification(notificationData, supabase);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error processing booking notification:", error);
    return NextResponse.json(
      { error: "Failed to process notification" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    // Verify user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return notification service status
    return NextResponse.json({
      success: true,
      message: "Booking notification service is running",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error checking notification service:", error);
    return NextResponse.json(
      { error: "Failed to check service status" },
      { status: 500 }
    );
  }
}
