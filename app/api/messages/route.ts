import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient, getUserWithRetry } from "@/lib/supabase/server-client";
import { ServerMessagesService, toMessagesErrorResponse } from "@/lib/services/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, ride_id, content } = body;

    if ((!conversation_id && !ride_id) || !content) {
      return NextResponse.json(
        { success: false, error: "conversation_id or ride_id and content are required" },
        { status: 400 }
      );
    }

    const supabase = await createApiSupabaseClient();
    const { user, errorType, error: authError } = await getUserWithRetry(supabase);

    if (!user) {
      if (errorType === "network") {
        return NextResponse.json(
          { success: false, error: "Service temporarily unavailable", details: "Network error during authentication" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: authError?.message },
        { status: 401 }
      );
    }

    const service = new ServerMessagesService(supabase);
    const messageWithSender = await service.sendMessage(
      { conversation_id, ride_id, content: String(content).trim() },
      user.id
    );

    return NextResponse.json({ success: true, data: messageWithSender });
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    return toMessagesErrorResponse(error);
  }
}
