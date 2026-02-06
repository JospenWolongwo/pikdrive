import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient, getUserWithRetry } from "@/lib/supabase/server-client";
import { ServerMessagesService, toMessagesErrorResponse } from "@/lib/services/server/messages-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    const { userId } = await request.json();
    const { rideId } = params;

    if (!rideId || !userId) {
      return NextResponse.json(
        { success: false, error: "rideId and userId are required" },
        { status: 400 }
      );
    }

    const supabase = createApiSupabaseClient();
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

    if (user.id !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const service = new ServerMessagesService(supabase);
    const conversation = await service.getOrCreateConversationByRide(rideId, userId);

    if (!conversation.participants.includes(userId)) {
      return NextResponse.json(
        { success: false, error: "User not authorized for this conversation" },
        { status: 403 }
      );
    }

    const updatedCount = await service.markMessagesAsRead(conversation.id, userId);

    return NextResponse.json({
      success: true,
      data: { conversationId: conversation.id, updatedCount },
    });
  } catch (error) {
    console.error("Error in POST /api/messages/read/[rideId]:", error);
    return toMessagesErrorResponse(error);
  }
}
