import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { ServerOneSignalNotificationService } from "@/lib/services/server/onesignal-notification-service";

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

    // Send notification via OneSignal Edge Function
    const notificationService = new ServerOneSignalNotificationService(supabase);
    
    await notificationService.sendNotification({
      userId: session.user.id,
      title: notificationData.title || 'PikDrive Notification',
      message: notificationData.message || 'You have a new notification',
      notificationType: notificationData.type || 'general',
      data: notificationData.data,
    });

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
