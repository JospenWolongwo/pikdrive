import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { RideWithPassengers, Passenger } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "auth-storage",
        },
      }
    );

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("API Debug - Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      sessionError: sessionError?.message,
    });

    if (!session || !session.user) {
      console.log("API Debug - Unauthorized access attempt");
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
    console.log("API Debug - Fetching rides for driver:", userId);
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

    console.log("API Debug - Rides query result:", {
      ridesCount: rides?.length || 0,
      error: ridesError?.message,
      code: ridesError?.code,
      sampleRide: rides?.[0] // Log first ride to see structure
    });

    if (ridesError) {
      console.error("Error fetching driver rides:", ridesError);
      return NextResponse.json(
        { error: "Failed to fetch rides" },
        { status: 500 }
      );
    }

    // Fetch bookings for each ride separately
    const ridesWithBookings: RideWithPassengers[] = await Promise.all(
      (rides || []).map(async (ride): Promise<RideWithPassengers> => {
        console.log("API Debug - Fetching bookings for ride:", ride.id);
        const { data: bookings, error: bookingsError } = await supabase
          .from("bookings")
          .select(`
            id,
            seats,
            status,
            payment_status,
            created_at,
            user_id
          `)
          .eq("ride_id", ride.id);

        console.log("API Debug - Bookings query result:", {
          rideId: ride.id,
          bookingsCount: bookings?.length || 0,
          error: bookingsError?.message,
          code: bookingsError?.code
        });

        if (bookingsError) {
          console.error("Error fetching bookings for ride:", ride.id, bookingsError);
          return {
            id: ride.id,
            from_city: ride.from_city,
            to_city: ride.to_city,
            departure_time: ride.departure_time,
            departure_date: ride.departure_time ? ride.departure_time.split('T')[0] : null,
            price_per_seat: ride.price || 0,
            total_seats: ride.seats_available || 0,
            available_seats: ride.seats_available || 0,
            created_at: ride.created_at,
            passengers: [],
          };
        }

        // Fetch user profiles for each booking
        const passengersWithProfiles: Passenger[] = await Promise.all(
          (bookings || []).map(async (booking): Promise<Passenger> => {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url, phone")
              .eq("id", booking.user_id)
              .single();

            if (profileError) {
              console.error("Error fetching profile for user:", booking.user_id, profileError);
              
              // Determine the appropriate fallback based on error type
              let fallbackName = "Utilisateur inconnu";
              if (profileError.code === 'PGRST116') {
                // Profile not found
                fallbackName = "Profil supprimé";
              } else if (profileError.code === '42501') {
                // Permission denied
                fallbackName = "Accès refusé";
              } else if (profileError.message?.includes('timeout')) {
                // Network timeout
                fallbackName = "Chargement...";
              }
              
              return {
                booking_id: booking.id,
                user_id: booking.user_id,
                seats: booking.seats,
                status: booking.status,
                payment_status: booking.payment_status,
                booking_created_at: booking.created_at,
                full_name: fallbackName,
                avatar_url: undefined,
                phone: undefined,
                _profileError: true, // Flag to indicate this is a fallback
              };
            }

            return {
              booking_id: booking.id,
              user_id: booking.user_id,
              seats: booking.seats,
              status: booking.status,
              payment_status: booking.payment_status,
              booking_created_at: booking.created_at,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              phone: profile.phone,
            };
          })
        );

        return {
          id: ride.id,
          from_city: ride.from_city,
          to_city: ride.to_city,
          departure_time: ride.departure_time,
          departure_date: ride.departure_time ? ride.departure_time.split('T')[0] : null, // Extract date from datetime
          price_per_seat: ride.price || 0,
          total_seats: (ride.seats_available || 0) + passengersWithProfiles.reduce((sum, p) => sum + p.seats, 0),
          available_seats: ride.seats_available || 0,
          created_at: ride.created_at,
          passengers: passengersWithProfiles,
        };
      })
    );

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
