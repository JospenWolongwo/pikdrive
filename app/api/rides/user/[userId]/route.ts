import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const userId = params.userId;

    // Verify the user is requesting their own rides or has permission
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: "Access denied. Can only fetch your own rides." },
        { status: 403 }
      );
    }

    // Get rides where user is the driver
    const { data: driverRides, error: driverError } = await supabase
      .from("rides")
      .select(`
        id,
        from_city,
        to_city,
        departure_time,
        driver_id,
        price,
        seats_available,
        car_model,
        car_color,
        created_at,
        updated_at
      `)
      .eq("driver_id", userId)
      .order("departure_time", { ascending: false });

    if (driverError) {
      console.error("Error fetching driver rides:", driverError);
      return NextResponse.json(
        { error: "Failed to fetch driver rides", details: driverError.message },
        { status: 500 }
      );
    }

    // Get rides where user has bookings (as passenger)
    const { data: passengerRides, error: passengerError } = await supabase
      .from("rides")
      .select(`
        id,
        from_city,
        to_city,
        departure_time,
        driver_id,
        price,
        seats_available,
        car_model,
        car_color,
        created_at,
        updated_at,
        bookings!inner (
          id,
          user_id,
          ride_id,
          seats,
          status
        )
      `)
      .eq("bookings.user_id", userId)
      .order("departure_time", { ascending: false });

    if (passengerError) {
      console.error("Error fetching passenger rides:", passengerError);
      return NextResponse.json(
        { error: "Failed to fetch passenger rides", details: passengerError.message },
        { status: 500 }
      );
    }

    // Combine and deduplicate rides
    const allRides = [...(driverRides || []), ...(passengerRides || [])];
    const uniqueRides = allRides.filter((ride, index, self) => 
      index === self.findIndex(r => r.id === ride.id)
    );

    return NextResponse.json({
      success: true,
      data: uniqueRides,
    });

  } catch (error) {
    console.error("Error in user rides API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
