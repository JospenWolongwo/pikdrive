import type { Ride, RideWithDetails } from "@/types";
import {
  enrichRidePickupPointNames,
  type RideWithPickupPoints,
} from "../enrich-ride-pickup-point-names";
import { getAvatarUrl } from "@/lib/utils/avatar-url";
import { getCorridorFallbackDestinations } from "../route-corridors";
import {
  type DriverRidesParams,
  type GetRidesParams,
  RideApiError,
  type RideOperationContext,
  type RideReadOperationContext,
} from "./shared";

export async function getRidesOperation(
  context: RideOperationContext,
  params?: GetRidesParams
) {
  const { supabase } = context;
  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const offset = (page - 1) * limit;

  const fromCity =
    params?.from_city && params.from_city !== "any"
      ? params.from_city
      : undefined;
  const requestedToCity =
    params?.to_city && params.to_city !== "any" ? params.to_city : undefined;

  const buildRidesQuery = (toCities?: readonly string[]) => {
    let query = supabase
      .from("rides")
      .select(`
          *,
          driver:profiles!rides_driver_id_fkey(id, full_name, avatar_url),
          bookings(id, seats, status, payment_status)
        `)
      .eq("status", "active")
      .order("departure_time", { ascending: true });

    if (params?.driver_id) query = query.eq("driver_id", params.driver_id);
    if (fromCity) query = query.eq("from_city", fromCity);
    if (toCities && toCities.length > 0) {
      query =
        toCities.length === 1
          ? query.eq("to_city", toCities[0])
          : query.in("to_city", [...toCities]);
    }
    if (params?.min_price) query = query.gte("price", params.min_price);
    if (params?.max_price) query = query.lte("price", params.max_price);
    if (params?.min_seats)
      query = query.gte("seats_available", params.min_seats);
    if (params?.upcoming)
      query = query.gt("departure_time", new Date().toISOString());

    return query;
  };

  const buildCountQuery = (toCities?: readonly string[]) => {
    let query = supabase
      .from("rides")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (params?.driver_id) query = query.eq("driver_id", params.driver_id);
    if (fromCity) query = query.eq("from_city", fromCity);
    if (toCities && toCities.length > 0) {
      query =
        toCities.length === 1
          ? query.eq("to_city", toCities[0])
          : query.in("to_city", [...toCities]);
    }
    if (params?.min_price) query = query.gte("price", params.min_price);
    if (params?.max_price) query = query.lte("price", params.max_price);
    if (params?.min_seats)
      query = query.gte("seats_available", params.min_seats);
    if (params?.upcoming)
      query = query.gt("departure_time", new Date().toISOString());

    return query;
  };

  let activeToCities: string[] | undefined = requestedToCity
    ? [requestedToCity]
    : undefined;
  let matchType: "exact" | "corridor_fallback" = "exact";
  let fallbackToCities: string[] = [];

  let countQuery = buildCountQuery(activeToCities);
  let { count, error: countError } = await countQuery;
  if (countError) {
    throw new Error(`Failed to get ride count: ${countError.message}`);
  }

  let { data: rides, error: ridesError } = await buildRidesQuery(
    activeToCities
  ).range(offset, offset + limit - 1);
  if (ridesError) {
    throw new Error(`Failed to fetch rides: ${ridesError.message}`);
  }

  if ((!rides || rides.length === 0) && fromCity && requestedToCity) {
    fallbackToCities = getCorridorFallbackDestinations(fromCity, requestedToCity);
    if (fallbackToCities.length > 0) {
      activeToCities = fallbackToCities;
      matchType = "corridor_fallback";

      countQuery = buildCountQuery(activeToCities);
      ({ count, error: countError } = await countQuery);
      if (countError) {
        throw new Error(`Failed to get ride count: ${countError.message}`);
      }

      ({ data: rides, error: ridesError } = await buildRidesQuery(
        activeToCities
      ).range(offset, offset + limit - 1));
      if (ridesError) {
        throw new Error(`Failed to fetch rides: ${ridesError.message}`);
      }

      if (rides && rides.length > 1) {
        const fallbackOrder = new Map(
          fallbackToCities.map((city, index) => [city.toLowerCase(), index])
        );

        rides = [...rides].sort((a: any, b: any) => {
          const aOrder =
            fallbackOrder.get((a.to_city || "").toLowerCase()) ??
            Number.MAX_SAFE_INTEGER;
          const bOrder =
            fallbackOrder.get((b.to_city || "").toLowerCase()) ??
            Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (
            new Date(a.departure_time).getTime() -
            new Date(b.departure_time).getTime()
          );
        });
      }
    }
  }

  const driverIds = [...new Set((rides || []).map((ride: any) => ride.driver_id))];

  const { data: driverDocuments } = await supabase
    .from("driver_documents")
    .select("driver_id, vehicle_images")
    .in("driver_id", driverIds);

  const vehicleImagesMap = new Map<string, string[]>();
  if (driverDocuments) {
    driverDocuments.forEach((doc: any) => {
      if (doc.vehicle_images && doc.vehicle_images.length > 0) {
        vehicleImagesMap.set(doc.driver_id, doc.vehicle_images);
      }
    });
  }

  const ridesMerged = (rides || []).map((ride: any) => {
    const vehicleImages = vehicleImagesMap.get(ride.driver_id) || [];
    let pickupPoints: unknown = undefined;
    if (ride.pickup_points) {
      try {
        pickupPoints =
          typeof ride.pickup_points === "string"
            ? JSON.parse(ride.pickup_points)
            : ride.pickup_points;
      } catch (e) {
        console.error("Error parsing pickup_points:", e);
      }
    }
    const driver = ride.driver
      ? {
          ...ride.driver,
          avatar_url: getAvatarUrl(supabase, ride.driver.avatar_url) ?? null,
          vehicle_images: vehicleImages,
        }
      : null;
    return {
      ...ride,
      pickup_points: pickupPoints,
      driver,
    };
  });

  const data = await enrichRidePickupPointNames(supabase, ridesMerged);
  const totalPages = Math.ceil((count || 0) / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: totalPages,
    },
    search_metadata: requestedToCity
      ? {
          match_type: matchType,
          requested_from_city: fromCity,
          requested_to_city: requestedToCity,
          fallback_to_cities:
            matchType === "corridor_fallback" ? fallbackToCities : [],
          notice_key:
            matchType === "corridor_fallback"
              ? "pages.rides.fallbackNotice"
              : undefined,
        }
      : undefined,
  };
}

export async function getRideByIdOperation(
  context: RideOperationContext,
  rideId: string
): Promise<RideWithDetails | null> {
  const { supabase } = context;

  const { data, error } = await supabase
    .from("rides")
    .select(`
        *,
        driver:profiles!rides_driver_id_fkey(id, full_name, avatar_url, phone),
        bookings(
          id,
          user_id,
          seats,
          status,
          payment_status,
          code_verified,
          pickup_time,
          no_show_marked_at,
          no_show_marked_by,
          no_show_contact_attempted,
          no_show_note,
          created_at,
          user:profiles(id, full_name, avatar_url, phone)
        )
      `)
    .eq("id", rideId)
    .neq("status", "cancelled")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch ride: ${error.message}`);
  }

  return data;
}

export async function getRideByIdForApiOperation(
  context: RideReadOperationContext,
  rideId: string
): Promise<RideWithDetails> {
  const { supabase, bookingPolicyService } = context;

  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .select(`
        *,
        driver:profiles!rides_driver_id_fkey(id, full_name, avatar_url),
        bookings(
          id,
          user_id,
          seats,
          status,
          payment_status,
          code_verified,
          selected_pickup_point_id,
          pickup_time,
          no_show_marked_at,
          no_show_marked_by,
          no_show_contact_attempted,
          no_show_note,
          created_at
        )
      `)
    .eq("id", rideId)
    .neq("status", "cancelled")
    .single();

  if (rideError) {
    if (rideError.code === "PGRST116") {
      throw new RideApiError("Ride not found", 404);
    }
    throw new RideApiError(`Failed to fetch ride: ${rideError.message}`, 500);
  }

  let enrichedRide = { ...ride };
  if (!enrichedRide.bookings) {
    enrichedRide.bookings = [];
  }

  if (enrichedRide.bookings.length > 0) {
    const userIds = [
      ...new Set(
        enrichedRide.bookings
          .map((b: { user_id: string }) => b.user_id)
          .filter(Boolean)
      ),
    ];
    const fallbackUser = {
      full_name: "Utilisateur inconnu",
      avatar_url: null,
    };

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        enrichedRide.bookings = enrichedRide.bookings.map(
          (booking: { user_id: string }) => ({
            ...booking,
            user: { id: booking.user_id || "", ...fallbackUser },
          })
        );
      } else {
        const profilesMap = new Map(
          (profiles || []).map((p: { id: string }) => [p.id, p])
        );
        enrichedRide.bookings = enrichedRide.bookings.map(
          (booking: { user_id: string }) => ({
            ...booking,
            user:
              profilesMap.get(booking.user_id) || {
                id: booking.user_id,
                ...fallbackUser,
              },
          })
        );
      }
    } else {
      enrichedRide.bookings = enrichedRide.bookings.map(
        (booking: { user_id: string }) => ({
          ...booking,
          user: { id: booking.user_id || "", ...fallbackUser },
        })
      );
    }

    enrichedRide.bookings = enrichedRide.bookings.map((booking: any) => {
      const policy = bookingPolicyService.evaluatePolicy({
        status: booking.status,
        payment_status: booking.payment_status,
        code_verified: booking.code_verified,
        pickup_time: booking.pickup_time,
        departure_time: enrichedRide.departure_time,
        no_show_marked_at: booking.no_show_marked_at,
      });

      return policy
        ? {
            ...booking,
            policy,
          }
        : booking;
    });
  }

  return enrichRidePickupPointNames(supabase, enrichedRide);
}

export async function getDriverRidesOperation(
  context: RideOperationContext,
  driverId: string,
  params?: DriverRidesParams
): Promise<RideWithDetails[]> {
  const { supabase } = context;

  let query = supabase
    .from("rides")
    .select("id")
    .eq("driver_id", driverId)
    .eq("status", "active")
    .order("departure_time", { ascending: true });

  if (params?.upcoming) {
    query = query.gt("departure_time", new Date().toISOString());
  } else if (params?.past) {
    query = query.lte("departure_time", new Date().toISOString());
  }

  const { data: rides, error: ridesError } = await query;

  if (ridesError) {
    throw new Error(`Failed to fetch driver rides: ${ridesError.message}`);
  }

  if (!rides || rides.length === 0) {
    return [];
  }

  const rideIds = rides.map((r: any) => r.id);

  const { data: detailedRides, error: detailsError } = await supabase
    .from("rides")
    .select(`
        *,
        driver:profiles!rides_driver_id_fkey(id, full_name, avatar_url, phone),
        bookings(
          id,
          user_id,
          seats,
          status,
          payment_status,
          created_at,
          user:profiles(id, full_name, avatar_url, phone)
        )
      `)
    .in("id", rideIds)
    .eq("status", "active")
    .order("departure_time", { ascending: true });

  if (detailsError) {
    throw new Error(`Failed to fetch ride details: ${detailsError.message}`);
  }

  return (detailedRides || []).map((ride: any) => ({
    ...ride,
    bookings: (ride.bookings || []).filter(
      (booking: any) => booking.status !== "cancelled"
    ),
  }));
}

export async function getUserRidesOperation(
  context: RideOperationContext,
  userId: string
): Promise<Ride[]> {
  const { supabase } = context;

  const { data: driverRides, error: driverError } = await supabase
    .from("rides")
    .select("*")
    .eq("driver_id", userId)
    .eq("status", "active")
    .order("departure_time", { ascending: false });

  if (driverError) {
    throw new Error(`Failed to fetch driver rides: ${driverError.message}`);
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("ride_id")
    .eq("user_id", userId);

  if (bookingsError) {
    throw new Error(`Failed to fetch user bookings: ${bookingsError.message}`);
  }

  const passengerRideIds = bookings?.map((b: any) => b.ride_id) || [];

  if (passengerRideIds.length === 0) {
    return driverRides || [];
  }

  const { data: passengerRides, error: passengerError } = await supabase
    .from("rides")
    .select("*")
    .in("id", passengerRideIds)
    .eq("status", "active")
    .order("departure_time", { ascending: false });

  if (passengerError) {
    throw new Error(`Failed to fetch passenger rides: ${passengerError.message}`);
  }

  const allRides = [...(driverRides || []), ...(passengerRides || [])];
  const uniqueRides = Array.from(
    new Map(allRides.map((ride: any) => [ride.id, ride])).values()
  );

  return uniqueRides;
}

