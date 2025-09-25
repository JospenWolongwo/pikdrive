import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { ride_id, driver_id, passenger_id } = await request.json();

    if (!ride_id || !driver_id || !passenger_id) {
      return NextResponse.json(
        { success: false, error: "ride_id, driver_id, and passenger_id are required" },
        { status: 400 }
      );
    }

    // Get the current user from the request headers
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Authorization header required" },
        { status: 401 }
      );
    }

    // Create a Supabase client with the user's token
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Invalid authentication" },
        { status: 401 }
      );
    }

    // Verify the user is either the driver or passenger
    if (user.id !== driver_id && user.id !== passenger_id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // First check if a conversation already exists for this ride
    const { data: existing, error: fetchError } = await supabaseClient
      .from("conversations")
      .select("*")
      .eq("ride_id", ride_id)
      .contains("participants", [driver_id, passenger_id])
      .maybeSingle();

    if (fetchError) {
      console.error("Error checking existing conversation:", fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json({ success: true, data: existing });
    }

    // Create new conversation
    const { data, error } = await supabaseClient
      .from("conversations")
      .insert([
        {
          ride_id,
          participants: [driver_id, passenger_id],
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error in POST /api/conversations:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

