import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient, getUserWithRetry } from "@/lib/supabase/server-client";
import { ServerMessagesService, toMessagesErrorResponse } from "@/lib/services/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    const { rideId } = params;

    if (!rideId) {
      return NextResponse.json(
        { success: false, error: "rideId is required" },
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
    const conversation = await service.getOrCreateConversationByRide(rideId, user.id);
    const messages = await service.getMessagesWithSenders(conversation.id);

    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error("Error in GET /api/messages/ride/[rideId]:", error);
    return toMessagesErrorResponse(error);
  }
}
