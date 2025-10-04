import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Ride, CreateRideRequest, UpdateRideRequest } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    // Note: This is a public endpoint - no authentication required for browsing rides
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driver_id");
    const fromCity = searchParams.get("from_city");
    const toCity = searchParams.get("to_city");
    const minPrice = searchParams.get("min_price");
    const maxPrice = searchParams.get("max_price");
    const minSeats = searchParams.get("min_seats");
    const upcoming = searchParams.get("upcoming") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    let query = supabase
      .from("rides")
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url),
        bookings(id, seats, status, payment_status)
      `)
      .order("departure_time", { ascending: true });

    // Apply filters
    if (driverId) {
      query = query.eq("driver_id", driverId);
    }
    if (fromCity && fromCity !== "any") {
      query = query.eq("from_city", fromCity);
    }
    if (toCity && toCity !== "any") {
      query = query.eq("to_city", toCity);
    }
    if (minPrice) {
      query = query.gte("price", parseInt(minPrice));
    }
    if (maxPrice) {
      query = query.lte("price", parseInt(maxPrice));
    }
    if (minSeats) {
      query = query.gte("seats_available", parseInt(minSeats));
    }
    if (upcoming) {
      query = query.gt("departure_time", new Date().toISOString());
    }

    // Get total count for pagination
    const countQuery = supabase
      .from("rides")
      .select("*", { count: "exact", head: true });
    
    // Apply same filters to count query
    if (driverId) countQuery.eq("driver_id", driverId);
    if (fromCity && fromCity !== "any") countQuery.eq("from_city", fromCity);
    if (toCity && toCity !== "any") countQuery.eq("to_city", toCity);
    if (minPrice) countQuery.gte("price", parseInt(minPrice));
    if (maxPrice) countQuery.lte("price", parseInt(maxPrice));
    if (minSeats) countQuery.gte("seats_available", parseInt(minSeats));
    if (upcoming) countQuery.gt("departure_time", new Date().toISOString());
    
    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Error getting ride count:", countError);
      return NextResponse.json(
        { error: "Failed to get ride count" },
        { status: 500 }
      );
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: rides, error: ridesError } = await query;

    if (ridesError) {
      console.error("Error fetching rides:", ridesError);
      return NextResponse.json(
        { error: "Failed to fetch rides" },
        { status: 500 }
      );
    }

    // Fetch vehicle images for all drivers
    const driverIds = [...new Set((rides || []).map((ride: any) => ride.driver_id))];
    
    const { data: driverDocuments, error: docsError } = await supabase
      .from("driver_documents")
      .select("driver_id, vehicle_images")
      .in("driver_id", driverIds);

    if (docsError) {
      console.error("Error fetching driver documents:", docsError);
    }

    // Create a map of driver_id to vehicle_images
    const vehicleImagesMap = new Map<string, string[]>();
    if (driverDocuments) {
      driverDocuments.forEach((doc: any) => {
        if (doc.vehicle_images && doc.vehicle_images.length > 0) {
          vehicleImagesMap.set(doc.driver_id, doc.vehicle_images);
        }
      });
    }

    // Merge vehicle images with rides data
    const ridesWithVehicleImages = (rides || []).map((ride: any) => {
      const vehicleImages = vehicleImagesMap.get(ride.driver_id) || [];
      
      return {
        ...ride,
        driver: {
          ...ride.driver,
          vehicle_images: vehicleImages,
        },
      };
    });

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: ridesWithVehicleImages,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error("Error in rides GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const rideData: CreateRideRequest = await request.json();

    // Validate required fields
    if (!rideData.from_city || !rideData.to_city || !rideData.departure_time || !rideData.price || !rideData.seats_available) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create the ride
    const { data: ride, error: createError } = await supabase
      .from("rides")
      .insert({
        driver_id: userId,
        from_city: rideData.from_city,
        to_city: rideData.to_city,
        departure_time: rideData.departure_time,
        price: rideData.price,
        seats_available: rideData.seats_available,
        description: rideData.description,
        car_model: rideData.car_model,
        car_color: rideData.car_color,
      })
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url)
      `)
      .single();

    if (createError) {
      console.error("Error creating ride:", createError);
      return NextResponse.json(
        { error: "Failed to create ride" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ride,
    });
  } catch (error) {
    console.error("Error in rides POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
