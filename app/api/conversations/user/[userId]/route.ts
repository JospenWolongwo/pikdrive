import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient, getUserWithRetry } from "@/lib/supabase/server-client";

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

    // Verify user authentication with retry
    const { user, errorType, error: authError } = await getUserWithRetry(supabaseClient);

    if (!user) {
      if (errorType === 'network') {
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

    // Verify the user is requesting their own conversations
    if (user.id !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch conversations for the user with participant details
    const { data, error } = await supabaseClient
      .from("conversations")
      .select(
        `
        *,
        ride:rides!inner (
          id,
          from_city,
          to_city,
          departure_time,
          driver_id
        )
        `
      )
      .contains("participants", [userId])
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform the data to include participant details and latest message
    const conversationsWithParticipants = await Promise.all(
      (data || []).map(async (conversation: any) => {
        // Get participant details
        const participantIds = conversation.participants.filter((id: string) => id !== userId);
        
        const { data: participants } = await supabaseClient
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", participantIds);

        // Get driver and passenger details
        const driverId = conversation.ride?.driver_id;
        const { data: driver } = await supabaseClient
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", driverId)
          .single();

        const passengerId = participantIds.find((id: string) => id !== driverId);
        const { data: passenger } = await supabaseClient
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", passengerId)
          .single();

        // Get the latest message for this conversation
        const { data: lastMessage } = await supabaseClient
          .from("messages")
          .select("id, content, created_at, sender_id")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();


        return {
          ...conversation,
          driver: driver || { id: driverId, full_name: "Unknown", avatar_url: null },
          passenger: passenger || { id: passengerId, full_name: "Unknown", avatar_url: null },
          last_message: lastMessage ? {
            content: lastMessage.content,
            created_at: lastMessage.created_at,
            sender_id: lastMessage.sender_id
          } : null,
        };
      })
    );

    return NextResponse.json({ success: true, data: conversationsWithParticipants });
  } catch (error) {
    console.error("Error in GET /api/conversations/user/[userId]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

