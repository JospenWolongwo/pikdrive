import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import type { RideWithDetails } from "@/types";

// Force dynamic rendering since this route uses cookies() via createApiSupabaseClient()
export const dynamic = 'force-dynamic';

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

    // Get all rides for the driver first (newest first)
    let ridesQuery = supabase
      .from("rides")
      .select("id")
      .eq("driver_id", userId)
      .order("created_at", { ascending: false }); // Newest first

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

    // Fetch full rides and bookings in parallel (messages omitted for list – ride page loads its own)
    const [
      { data: fullRides, error: fullRidesError },
      { data: bookings },
    ] = await Promise.all([
      supabase
        .from("rides")
        .select("*")
        .in("id", rideIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("id, ride_id, user_id, seats, status, payment_status, code_verified, created_at, updated_at")
        .in("ride_id", rideIds)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),
    ]);

    if (fullRidesError) {
      console.error("Error fetching rides:", fullRidesError);
      return NextResponse.json(
        { error: "Failed to fetch rides" },
        { status: 500 }
      );
    }

    const userIds = [...new Set(bookings?.map((b: any) => b.user_id) || [])];
    let userProfiles: { [key: string]: { id: string; full_name: string; avatar_url?: string } } = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (users) {
        userProfiles = Object.fromEntries(users.map((u: any) => [u.id, u]));
      }
    }

    const ridesWithDetails = (fullRides || []).map((ride: any) => {
      const rideBookings = bookings?.filter((b: any) => b.ride_id === ride.id) || [];
      return {
        ...ride,
        bookings: rideBookings.map((booking: any) => ({
          ...booking,
          user: userProfiles[booking.user_id] || {
            id: booking.user_id,
            full_name: "Unknown User",
            avatar_url: null,
          },
        })),
        messages: [] as any[],
      };
    });

    console.log('✅ [DRIVER RIDES API] Returning rides:', {
      count: ridesWithDetails.length
    });

    return NextResponse.json({
      success: true,
      data: ridesWithDetails,
    });
  } catch (error) {
    console.error("Error in driver rides GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
