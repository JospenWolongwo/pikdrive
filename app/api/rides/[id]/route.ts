import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import type { Ride, UpdateRideRequest } from "@/types";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    console.log("🔍 [GET /api/rides/[id]] Fetching ride:", params.id);
    const supabase = createApiSupabaseClient();

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      console.error("❌ [GET /api/rides/[id]] Unauthorized");
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const rideId = params.id;
    console.log("✅ [GET /api/rides/[id]] User authenticated:", session.user.id);

    // Fetch ride with driver profile and bookings (without nested user profiles)
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url),
        bookings(
          id,
          user_id,
          seats,
          status,
          payment_status,
          code_verified,
          created_at
        )
      `)
      .eq("id", rideId)
      .single();

    if (rideError) {
      console.error("❌ [GET /api/rides/[id]] Error fetching ride:", rideError);
      if (rideError.code === "PGRST116") {
        console.log("⚠️ [GET /api/rides/[id]] Ride not found:", rideId);
        return NextResponse.json(
          { success: false, error: "Ride not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Failed to fetch ride", details: rideError.message },
        { status: 500 }
      );
    }

    console.log("✅ [GET /api/rides/[id]] Ride fetched successfully:", ride?.id);

    // Fetch user profiles separately if there are bookings
    let enrichedRide = { ...ride };
    
    // Ensure bookings is always an array
    if (!enrichedRide.bookings) {
      enrichedRide.bookings = [];
    }
    
    if (enrichedRide.bookings.length > 0) {
      const userIds = [...new Set(enrichedRide.bookings.map((b: any) => b.user_id).filter(Boolean))];
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        if (profilesError) {
          console.error("Error fetching user profiles:", profilesError);
          // Continue without profiles rather than failing completely
          // Add empty user objects to bookings
          enrichedRide.bookings = enrichedRide.bookings.map((booking: any) => ({
            ...booking,
            user: {
              id: booking.user_id || "",
              full_name: "Utilisateur inconnu",
              avatar_url: null,
            },
          }));
        } else {
          // Merge profiles with bookings
          const profilesMap = new Map(
            (profiles || []).map((p: any) => [p.id, p])
          );

          enrichedRide.bookings = enrichedRide.bookings.map((booking: any) => ({
            ...booking,
            user: profilesMap.get(booking.user_id) || {
              id: booking.user_id,
              full_name: "Utilisateur inconnu",
              avatar_url: null,
            },
          }));
        }
      } else {
        // No valid user IDs, just add empty user objects
        enrichedRide.bookings = enrichedRide.bookings.map((booking: any) => ({
          ...booking,
          user: {
            id: booking.user_id || "",
            full_name: "Utilisateur inconnu",
            avatar_url: null,
          },
        }));
      }
    }

    console.log("✅ [GET /api/rides/[id]] Returning enriched ride with", enrichedRide.bookings?.length || 0, "bookings");
    return NextResponse.json({
      success: true,
      data: enrichedRide,
    });
  } catch (error) {
    console.error("❌ [GET /api/rides/[id]] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const rideId = params.id;

    // Check if ride exists and user is the driver
    const { data: existingRide, error: checkError } = await supabase
      .from("rides")
      .select("driver_id")
      .eq("id", rideId)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Ride not found" },
          { status: 404 }
        );
      }
      console.error("Error checking ride:", checkError);
      return NextResponse.json(
        { error: "Failed to check ride" },
        { status: 500 }
      );
    }

    if (existingRide.driver_id !== userId) {
      return NextResponse.json(
        { error: "Access denied. You can only update your own rides." },
        { status: 403 }
      );
    }

    const updateData: UpdateRideRequest = await request.json();

    // Build update object with only provided fields
    const updateFields: any = {};
    if (updateData.from_city !== undefined) updateFields.from_city = updateData.from_city;
    if (updateData.to_city !== undefined) updateFields.to_city = updateData.to_city;
    if (updateData.departure_time !== undefined) updateFields.departure_time = updateData.departure_time;
    if (updateData.price !== undefined) updateFields.price = updateData.price;
    if (updateData.seats_available !== undefined) updateFields.seats_available = updateData.seats_available;
    if (updateData.description !== undefined) updateFields.description = updateData.description;
    if (updateData.car_model !== undefined) updateFields.car_model = updateData.car_model;
    if (updateData.car_color !== undefined) updateFields.car_color = updateData.car_color;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data: updatedRide, error: updateError } = await supabase
      .from("rides")
      .update(updateFields)
      .eq("id", rideId)
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url)
      `)
      .single();

    if (updateError) {
      console.error("Error updating ride:", updateError);
      return NextResponse.json(
        { error: "Failed to update ride" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedRide,
    });
  } catch (error) {
    console.error("Error in ride PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const rideId = params.id;

    // Check if ride exists and user is the driver
    const { data: existingRide, error: checkError } = await supabase
      .from("rides")
      .select("driver_id")
      .eq("id", rideId)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Ride not found" },
          { status: 404 }
        );
      }
      console.error("Error checking ride:", checkError);
      return NextResponse.json(
        { error: "Failed to check ride" },
        { status: 500 }
      );
    }

    if (existingRide.driver_id !== userId) {
      return NextResponse.json(
        { error: "Access denied. You can only delete your own rides." },
        { status: 403 }
      );
    }

    // Check if there are any confirmed bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("ride_id", rideId)
      .in("status", ["confirmed", "pending"]);

    if (bookingsError) {
      console.error("Error checking bookings:", bookingsError);
      return NextResponse.json(
        { error: "Failed to check bookings" },
        { status: 500 }
      );
    }

    if (bookings && bookings.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete ride with confirmed or pending bookings" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("rides")
      .delete()
      .eq("id", rideId);

    if (deleteError) {
      console.error("Error deleting ride:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete ride" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ride deleted successfully",
    });
  } catch (error) {
    console.error("Error in ride DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
