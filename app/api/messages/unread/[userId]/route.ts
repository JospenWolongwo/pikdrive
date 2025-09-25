import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Verify the user is requesting their own unread counts
    if (user.id !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch unread messages count by ride
    const { data, error } = await supabaseClient
      .from("messages")
      .select("ride_id")
      .eq("receiver_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Error fetching unread messages:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Count messages by ride_id
    const unreadCounts = (data || []).reduce(
      (acc: Record<string, number>, msg: { ride_id: string }) => {
        acc[msg.ride_id] = (acc[msg.ride_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Convert to array format
    const result = Object.entries(unreadCounts).map(([rideId, count]) => ({
      rideId,
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

