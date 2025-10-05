import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import type { RideWithPassengers, Passenger } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ 
        error: "Unauthorized", 
        details: sessionError?.message || "No session found" 
      }, { status: 401 });
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

    // Fetch driver's rides first
    const { data: rides, error: ridesError } = await supabase
      .from("rides")
      .select(`
        id,
        from_city,
        to_city,
        departure_time,
        price,
        seats_available,
        created_at
      `)
      .eq("driver_id", userId)
      .order("departure_time", { ascending: true });

    if (ridesError) {
      console.error("Error fetching driver rides:", ridesError);
      return NextResponse.json(
        { error: "Failed to fetch rides" },
        { status: 500 }
      );
    }

    // Fetch ALL bookings for ALL rides in a single query (much more efficient)
    const rideIds = rides?.map(r => r.id) || [];
    const { data: allBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        id,
        ride_id,
        seats,
        status,
        payment_status,
        code_verified,
        created_at,
        user_id
      `)
      .in("ride_id", rideIds);


    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }

    // Fetch ALL user profiles for ALL bookings in a single query
    const userIds = [...new Set(allBookings?.map(b => b.user_id) || [])]; // Remove duplicates
    const { data: allProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, phone")
      .in("id", userIds);


    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch user profiles" },
        { status: 500 }
      );
    }

    // Group bookings by ride_id and merge with profiles
    const bookingsByRide = (allBookings || []).reduce((acc, booking) => {
      if (!acc[booking.ride_id]) {
        acc[booking.ride_id] = [];
      }
      
      const profile = allProfiles?.find(p => p.id === booking.user_id);
      acc[booking.ride_id].push({
        booking_id: booking.id,
        user_id: booking.user_id,
        seats: booking.seats,
        status: booking.status,
        payment_status: booking.payment_status,
        booking_created_at: booking.created_at,
        full_name: profile?.full_name || "Utilisateur inconnu",
        avatar_url: profile?.avatar_url,
        phone: profile?.phone,
      });
      
      return acc;
    }, {} as Record<string, Passenger[]>);

    // Map rides with their bookings
    const ridesWithBookings: RideWithPassengers[] = (rides || []).map(ride => {
      const passengers = bookingsByRide[ride.id] || [];
      return {
        id: ride.id,
        from_city: ride.from_city,
        to_city: ride.to_city,
        departure_time: ride.departure_time,
        departure_date: ride.departure_time ? ride.departure_time.split('T')[0] : null,
        price_per_seat: ride.price || 0,
        total_seats: (ride.seats_available || 0) + passengers.reduce((sum, p) => sum + p.seats, 0),
        available_seats: ride.seats_available || 0,
        created_at: ride.created_at,
        passengers: passengers,
      };
    });

    return NextResponse.json({
      success: true,
      rides: ridesWithBookings,
    });
  } catch (error) {
    console.error("Error in driver reservations API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
