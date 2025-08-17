import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { sendPushNotification } from "@/lib/notifications/native-push-service";

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

    // Send notification using native service
    const result = await sendPushNotification(userId, {
      title,
      body,
      data,
      icon,
      badge,
      tag,
      actions,
    });

    if (result.success) {
      console.log(`📤 Push notification sent: ${result.message}`);
      return NextResponse.json({
        success: true,
        message: result.message,
        total: result.total,
        successful: result.sent,
        failed: result.total - result.sent,
      });
    } else {
      console.warn(`⚠️ Push notification failed: ${result.message}`);
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
  } catch (error) {
    console.error("Push notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
