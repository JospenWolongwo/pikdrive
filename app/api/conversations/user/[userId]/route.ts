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

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const user = session.user;

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
        ),
        last_message:messages (
          id,
          content,
          created_at,
          sender_id
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

    // Transform the data to include participant details
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

        return {
          ...conversation,
          driver: driver || { id: driverId, full_name: "Unknown", avatar_url: null },
          passenger: passenger || { id: passengerId, full_name: "Unknown", avatar_url: null },
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

