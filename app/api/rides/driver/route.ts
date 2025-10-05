import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import type { RideWithDetails } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Verify user is a driver
    const { data: driverData, error: driverError } = await supabase
      .from("profiles")
      .select("is_driver")
      .eq("id", userId)
      .single();

    if (driverError || !driverData?.is_driver) {
      return NextResponse.json(
        { error: "Access denied. Driver role required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") === "true";
    const past = searchParams.get("past") === "true";

    // Get all rides for the driver first
    let ridesQuery = supabase
      .from("rides")
      .select("id")
      .eq("driver_id", userId)
      .order("departure_time", { ascending: true });

    // Only apply time filters if specifically requested
    // If no filter is specified, return ALL rides (both upcoming and past)
    if (upcoming) {
      ridesQuery = ridesQuery.gt("departure_time", new Date().toISOString());
    } else if (past) {
      ridesQuery = ridesQuery.lte("departure_time", new Date().toISOString());
    }
    // If neither upcoming nor past is specified, get ALL rides

    const { data: rides, error: ridesError } = await ridesQuery;

    if (ridesError) {
      console.error("Error fetching driver rides:", ridesError);
      return NextResponse.json(
        { error: "Failed to fetch rides" },
        { status: 500 }
      );
    }

    if (!rides?.length) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const rideIds = rides.map((r: { id: string }) => r.id);

    // Get full ride details with bookings and messages
    const { data: fullRides, error: fullRidesError } = await supabase
      .from("rides")
      .select(`
        *,
        bookings(
          id,
          user_id,
          seats,
          status,
          payment_status,
          code_verified,
          created_at,
          updated_at
        ),
        messages(
          id,
          sender_id,
          content,
          created_at
        )
      `)
      .in("id", rideIds)
      .order("departure_time", { ascending: true });

    if (fullRidesError) {
      console.error("Error fetching full ride details:", fullRidesError);
      return NextResponse.json(
        { error: "Failed to fetch ride details" },
        { status: 500 }
      );
    }

    // Fetch user profiles for bookings separately to avoid relationship issues
    const ridesWithProfiles = await Promise.all(
      (fullRides || []).map(async (ride) => {
        if (ride.bookings && ride.bookings.length > 0) {
          const userIds = ride.bookings.map((booking: any) => booking.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", userIds);

          const bookingsWithProfiles = ride.bookings.map((booking: any) => ({
            ...booking,
            user: profiles?.find(profile => profile.id === booking.user_id) || null
          }));

          return {
            ...ride,
            bookings: bookingsWithProfiles
          };
        }
        return ride;
      })
    );

    return NextResponse.json({
      success: true,
      data: ridesWithProfiles || [],
    });
  } catch (error) {
    console.error("Error in driver rides GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
