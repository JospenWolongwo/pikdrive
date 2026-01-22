import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import type { Ride, CreateRideRequest, UpdateRideRequest, PickupPoint } from "@/types";
import { randomUUID } from "crypto";

// Force dynamic rendering since this route uses cookies() via createApiSupabaseClient()
export const dynamic = 'force-dynamic';

/**
 * Validate and process pickup points
 * Ensures at least 2 points, assigns IDs and orders if missing
 */
function validateAndProcessPickupPoints(
  pickupPoints: readonly PickupPoint[] | undefined
): PickupPoint[] | null {
  if (!pickupPoints || pickupPoints.length === 0) {
    return null; // Optional field, null is valid
  }

  // Require at least 2 pickup points
  if (pickupPoints.length < 2) {
    throw new Error("At least 2 pickup points are required");
  }

  // Process and validate each point
  return pickupPoints.map((point, index) => {
    // Validate required fields
    if (!point.name || typeof point.name !== 'string' || point.name.trim().length === 0) {
      throw new Error(`Pickup point ${index + 1}: name is required`);
    }

    if (typeof point.time_offset_minutes !== 'number' || point.time_offset_minutes < 0) {
      throw new Error(`Pickup point ${index + 1}: time_offset_minutes must be a non-negative number`);
    }

    // Auto-assign id and order if missing
    return {
      id: point.id || randomUUID(),
      name: point.name.trim(),
      order: point.order !== undefined ? point.order : index + 1,
      time_offset_minutes: point.time_offset_minutes,
    };
  }).sort((a, b) => a.order - b.order); // Sort by order
}

/**
 * Helper function to construct Supabase storage public URL
 */
function getStoragePublicUrl(filePath: string | null, bucket: string = 'avatars'): string | null {
  if (!filePath) return null;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  
  // If already a full URL, return as-is
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
}

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
      .select("*")
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
    let countQuery = supabase
      .from("rides")
      .select("*", { count: "exact", head: true });
    
    // Apply same filters to count query
    if (driverId) countQuery = countQuery.eq("driver_id", driverId);
    if (fromCity && fromCity !== "any") countQuery = countQuery.eq("from_city", fromCity);
    if (toCity && toCity !== "any") countQuery = countQuery.eq("to_city", toCity);
    if (minPrice) countQuery = countQuery.gte("price", parseInt(minPrice));
    if (maxPrice) countQuery = countQuery.lte("price", parseInt(maxPrice));
    if (minSeats) countQuery = countQuery.gte("seats_available", parseInt(minSeats));
    if (upcoming) countQuery = countQuery.gt("departure_time", new Date().toISOString());
    
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

    // Fetch driver profiles separately (avoids PostgREST relationship syntax issues)
    const driverIds = [...new Set((rides || []).map((ride: any) => ride.driver_id))];
    
    const { data: driverProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", driverIds);

    if (profilesError) {
      console.error("Error fetching driver profiles:", profilesError);
    }

    // Create a map of driver_id to driver profile
    const driverProfileMap = new Map<string, { id: string; full_name: string; avatar_url: string | null }>();
    if (driverProfiles) {
      driverProfiles.forEach((profile: any) => {
        driverProfileMap.set(profile.id, profile);
      });
    }

    // Fetch vehicle images for all drivers
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

    // Merge driver profiles and vehicle images with rides data
    const ridesWithVehicleImages = (rides || []).map((ride: any) => {
      const driverProfile = driverProfileMap.get(ride.driver_id);
      const vehicleImages = vehicleImagesMap.get(ride.driver_id) || [];
      
      // Parse pickup_points JSONB if present
      let pickupPoints: PickupPoint[] | undefined;
      if (ride.pickup_points) {
        try {
          pickupPoints = typeof ride.pickup_points === 'string' 
            ? JSON.parse(ride.pickup_points) 
            : ride.pickup_points;
        } catch (e) {
          console.error("Error parsing pickup_points:", e);
          pickupPoints = undefined;
        }
      }
      
      return {
        ...ride,
        pickup_points: pickupPoints,
        driver: driverProfile ? {
          ...driverProfile,
          avatar_url: getStoragePublicUrl(driverProfile.avatar_url, 'avatars'),
          vehicle_images: vehicleImages,
        } : null,
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

    // Verify user is a driver AND fetch profile data for response
    const { data: driverData, error: driverError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, is_driver")
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

    // Validate and process pickup points
    let processedPickupPoints: PickupPoint[] | null = null;
    try {
      processedPickupPoints = validateAndProcessPickupPoints(rideData.pickup_points);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid pickup points" },
        { status: 400 }
      );
    }

    // Prepare insert data
    const insertData: any = {
      driver_id: userId,
      from_city: rideData.from_city,
      to_city: rideData.to_city,
      departure_time: rideData.departure_time,
      price: rideData.price,
      seats_available: rideData.seats_available,
      description: rideData.description,
      car_model: rideData.car_model,
      car_color: rideData.car_color,
    };

    // Add pickup_points if provided
    if (processedPickupPoints) {
      insertData.pickup_points = processedPickupPoints;
    }

    // Create the ride
    const { data: ride, error: createError } = await supabase
      .from("rides")
      .insert(insertData)
      .select("*")
      .single();

    if (createError) {
      console.error("Error creating ride:", createError);
      return NextResponse.json(
        { error: "Failed to create ride" },
        { status: 500 }
      );
    }

    // Parse pickup_points JSONB if present
    let pickupPoints: PickupPoint[] | undefined;
    if (ride.pickup_points) {
      try {
        pickupPoints = typeof ride.pickup_points === 'string' 
          ? JSON.parse(ride.pickup_points) 
          : ride.pickup_points;
      } catch (e) {
        console.error("Error parsing pickup_points:", e);
        pickupPoints = undefined;
      }
    }

    // Attach driver profile (already fetched above - no extra query!)
    const rideWithDriver = {
      ...ride,
      pickup_points: pickupPoints,
      driver: {
        id: driverData.id,
        full_name: driverData.full_name,
        avatar_url: driverData.avatar_url,
      },
    };

    return NextResponse.json({
      success: true,
      data: rideWithDriver,
    });
  } catch (error) {
    console.error("Error in rides POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
