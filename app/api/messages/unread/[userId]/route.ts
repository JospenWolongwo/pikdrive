import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    // Create a Supabase client using cookie-based authentication
    const supabaseClient = createApiSupabaseClient();

    // Verify user authentication
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (!user || userError) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: userError?.message },
        { status: 401 }
      );
    }

    // Verify the user is requesting their own unread counts
    if (user.id !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch unread messages count by conversation
    const { data, error } = await supabaseClient
      .from("messages")
      .select("conversation_id, sender_id, read")
      .neq("sender_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Error fetching unread messages:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Count messages by conversation_id
    const unreadCounts = (data || []).reduce(
      (acc: Record<string, number>, msg: { conversation_id: string }) => {
        acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Convert to array format
    const result = Object.entries(unreadCounts).map(([conversationId, count]) => ({
      conversationId: conversationId,
      count,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error in GET /api/messages/unread/[userId]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

