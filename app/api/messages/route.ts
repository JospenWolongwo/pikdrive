import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient, getUserWithRetry } from "@/lib/supabase/server-client";

export async function POST(request: NextRequest) {
  try {
    const { conversation_id, ride_id, content } = await request.json();

    if ((!conversation_id && !ride_id) || !content) {
      return NextResponse.json(
        { success: false, error: "conversation_id or ride_id and content are required" },
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

    // Determine the conversation ID
    let finalConversationId = conversation_id;

    if (!finalConversationId && ride_id) {
      // Look for existing conversation for this ride
      let { data: conversations, error: convError } = await supabaseClient
        .from("conversations")
        .select("id, participants")
        .eq("ride_id", ride_id);

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

      if (!conversation) {
        // Get ride details to find driver and passenger
        const { data: ride, error: rideError } = await supabaseClient
          .from("rides")
          .select("driver_id")
          .eq("id", ride_id)
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
            .eq("ride_id", ride_id)
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
            ride_id: ride_id,
            participants: [user.id, otherParticipant]
          })
          .select("id")
          .single();

        if (createError) {
          return NextResponse.json(
            { success: false, error: createError.message },
            { status: 500 }
          );
        }

        finalConversationId = newConversation.id;
      } else {
        finalConversationId = conversation.id;
      }
    }

    // Filter content to remove potentially harmful characters
    const filteredContent = content.trim();

    // Insert the message
    const { data: message, error: messageError } = await supabaseClient
      .from("messages")
      .insert({
        conversation_id: finalConversationId,
        sender_id: user.id,
        content: filteredContent,
        read: false
      })
      .select("*")
      .single();

    if (messageError) {
      return NextResponse.json(
        { success: false, error: messageError.message },
        { status: 500 }
      );
    }

    // Fetch sender profile
    const { data: senderProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { success: false, error: "Error fetching sender profile" },
        { status: 500 }
      );
    }

    // Combine message with sender data
    const messageWithSender = {
      ...message,
      sender: {
        id: senderProfile.id,
        full_name: senderProfile.full_name,
        avatar_url: senderProfile.avatar_url
      }
    };

    return NextResponse.json({ success: true, data: messageWithSender });
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}