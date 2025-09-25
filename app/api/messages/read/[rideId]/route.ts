import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PUT(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    const { rideId } = params;
    const { userId } = await request.json();

    if (!rideId || !userId) {
      return NextResponse.json(
        { success: false, error: "rideId and userId are required" },
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

    // Verify the user is marking their own messages as read
    if (user.id !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Mark messages as read
    const { error } = await supabaseClient
      .from("messages")
      .update({ read: true })
      .eq("ride_id", rideId)
      .eq("receiver_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Error marking messages as read:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("Error in PUT /api/messages/read/[rideId]:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

