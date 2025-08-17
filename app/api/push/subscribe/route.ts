import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { subscription } = await request.json();
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Store subscription in database
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: session.user.id,
      subscription: subscription,
      is_active: true,
    });

    if (error) {
      console.error("Failed to store subscription:", error);
      return NextResponse.json(
        { error: "Failed to store subscription" },
        { status: 500 }
      );
    }

    console.log("✅ Push subscription stored for user:", session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription storage error:", error);
    return NextResponse.json(
      { error: "Failed to store subscription" },
      { status: 500 }
    );
  }
}
