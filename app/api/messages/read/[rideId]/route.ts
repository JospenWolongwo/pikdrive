import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient, getUserWithRetry } from "@/lib/supabase/server-client";

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

    // Verify the user is requesting to mark their own messages as read
    if (user.id !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get conversations for this ride
    let { data: conversations, error: convError } = await supabaseClient
      .from("conversations")
      .select("id, participants")
      .eq("ride_id", rideId);

    if (convError) {
      return NextResponse.json(
        { success: false, error: convError.message },
        { status: 500 }
      );
    }

    // Find the conversation that includes the current user
    let conversation = conversations?.find(conv => 
      conv.participants.includes(userId)
    );

    // If no conversation exists, try to create one
    if (!conversation) {
      // Get ride details to find driver and passenger
      const { data: ride, error: rideError } = await supabaseClient
        .from("rides")
        .select("driver_id")
        .eq("id", rideId)
        .single();

      if (rideError || !ride) {
        return NextResponse.json(
          { success: false, error: "Ride not found" },
          { status: 404 }
        );
      }

      // Get the other participant
      let otherParticipant: string | null = null;
      if (ride.driver_id === userId) {
        const { data: bookingRow, error: bookingError } = await supabaseClient
          .from("bookings")
          .select("user_id")
          .eq("ride_id", rideId)
          .neq("user_id", userId)
          .limit(1)
          .maybeSingle();
        
        if (bookingError) {
          return NextResponse.json(
            { success: false, error: "Error finding passenger" },
            { status: 500 }
          );
        }
        otherParticipant = bookingRow?.user_id ?? null;
      } else {
        otherParticipant = ride.driver_id;
      }

      if (!otherParticipant) {
        return NextResponse.json(
          { success: false, error: "No other participant found for this ride" },
          { status: 404 }
        );
      }

      // Create conversation
      const { data: newConversation, error: createError } = await supabaseClient
        .from("conversations")
        .insert({
          ride_id: rideId,
          participants: [userId, otherParticipant]
        })
        .select("id, participants")
        .single();

      if (createError) {
        return NextResponse.json(
          { success: false, error: createError.message },
          { status: 500 }
        );
      }

      conversation = newConversation;
    }

    // Verify user is a participant
    if (!conversation.participants.includes(userId)) {
      return NextResponse.json(
        { success: false, error: "User not authorized for this conversation" },
        { status: 403 }
      );
    }

    // Mark messages as read for this conversation
    const { data: updateData, error: updateError } = await supabaseClient
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", conversation.id)
      .neq("sender_id", userId)
      .eq("read", false)
      .select("id");

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        conversationId: conversation.id,
        updatedCount: updateData?.length || 0 
      } 
    });
  } catch (error) {
    console.error("Error in POST /api/messages/read/[rideId]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}