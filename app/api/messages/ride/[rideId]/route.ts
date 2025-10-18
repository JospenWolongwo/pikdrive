import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient, getUserWithRetry } from "@/lib/supabase/server-client";

export async function GET(
  request: NextRequest,
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

    // First, get the conversation for this ride
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
      conv.participants.includes(user.id)
    );

    // If no conversation exists, we need to get ride details to create one
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

      // Get the other participant (not the current user)
      let otherParticipant: string | null = null;
      if (ride.driver_id === user.id) {
        const { data: bookingRow, error: bookingError } = await supabaseClient
          .from("bookings")
          .select("user_id")
          .eq("ride_id", rideId)
          .neq("user_id", user.id)
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
          participants: [user.id, otherParticipant]
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

    // Fetch messages for the conversation
    const { data: messages, error: messagesError } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { success: false, error: messagesError.message },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get unique sender IDs
    const senderIds = [...new Set(messages.map(msg => msg.sender_id))];

    // Fetch sender profiles
    if (senderIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", senderIds);

    if (profilesError) {
      return NextResponse.json(
        { success: false, error: profilesError.message },
        { status: 500 }
      );
    }

    // Create a map of sender profiles
    const profileMap = new Map();
    profiles?.forEach(profile => {
      profileMap.set(profile.id, {
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      });
    });

    // Combine messages with sender data
    const messagesWithSenders = messages.map(message => ({
      ...message,
      sender: profileMap.get(message.sender_id) || {
        id: message.sender_id,
        full_name: "Unknown",
        avatar_url: null
      }
    }));

    return NextResponse.json({ success: true, data: messagesWithSenders });
  } catch (error) {
    console.error("Error in GET /api/messages/ride/[rideId]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}