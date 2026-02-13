import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { notifyAdminsForDriverApplication } from "@/lib/services/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const body = await request.json().catch(() => ({}));
    const driverId = body?.driverId as string | undefined;
    const submittedAt = body?.submittedAt as string | undefined;

    const result = await notifyAdminsForDriverApplication(supabase, driverId || '', submittedAt);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to notify admins' }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, notified: result.notified ?? 0 });
  } catch (error) {
    console.error("Error notifying admins for driver application:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
