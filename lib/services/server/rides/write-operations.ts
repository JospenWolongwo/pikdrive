import type {
  CreateRideRequest,
  Ride,
  RideWithDetails,
  RideWithDriver,
  UpdateRideRequest,
} from "@/types";
import {
  enrichRidePickupPointNames,
  type RideWithPickupPoints,
} from "../enrich-ride-pickup-point-names";
import { validateAndProcessPickupPoints } from "../validate-ride-pickup-points";
import { validateAndResolveDropoffPoint } from "../validate-ride-dropoff-point";
import { getAvatarUrl } from "@/lib/utils/avatar-url";
import {
  MAX_RIDE_PRICE_FCFA,
  RideApiError,
  type RideOperationContext,
} from "./shared";

export async function createRideForApiOperation(
  context: RideOperationContext,
  userId: string,
  rideData: CreateRideRequest
): Promise<RideWithDriver> {
  const { supabase } = context;

  const { data: driverData, error: driverError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, is_driver")
    .eq("id", userId)
    .single();

  if (driverError || !driverData?.is_driver) {
    throw new RideApiError("Access denied. Driver role required.", 403);
  }

  if (
    !rideData.from_city ||
    !rideData.to_city ||
    !rideData.dropoff_point_id ||
    !rideData.departure_time ||
    rideData.price == null ||
    rideData.seats_available == null
  ) {
    throw new RideApiError("Missing required fields", 400);
  }
  if (rideData.price > MAX_RIDE_PRICE_FCFA) {
    throw new RideApiError("Our price limit is 6000 FCFA per ride.", 400);
  }

  let processedPickupPoints:
    | { id: string; order: number; time_offset_minutes: number }[]
    | null = null;
  try {
    processedPickupPoints = await validateAndProcessPickupPoints(
      supabase,
      rideData.from_city,
      rideData.pickup_points
    );
  } catch (e) {
    throw new RideApiError(
      e instanceof Error ? e.message : "Invalid pickup points",
      400
    );
  }

  let dropoffPoint: { id: string; name: string };
  try {
    dropoffPoint = await validateAndResolveDropoffPoint(
      supabase,
      rideData.to_city,
      rideData.dropoff_point_id
    );
  } catch (e) {
    throw new RideApiError(
      e instanceof Error ? e.message : "Invalid dropoff point",
      400
    );
  }

  const insertData: Record<string, unknown> = {
    driver_id: userId,
    from_city: rideData.from_city,
    to_city: rideData.to_city,
    dropoff_point_id: dropoffPoint.id,
    dropoff_point_name: dropoffPoint.name,
    departure_time: rideData.departure_time,
    price: rideData.price,
    seats_available: rideData.seats_available,
    description: rideData.description,
    car_model: rideData.car_model,
    car_color: rideData.car_color,
  };
  if (processedPickupPoints) {
    insertData.pickup_points = processedPickupPoints;
  }

  const { data: ride, error: createError } = await supabase
    .from("rides")
    .insert(insertData)
    .select("*")
    .single();

  if (createError) {
    throw new RideApiError("Failed to create ride", 500);
  }

  const rideEnriched = await enrichRidePickupPointNames(
    supabase,
    ride as RideWithPickupPoints
  );
  return {
    ...rideEnriched,
    driver: {
      id: driverData.id,
      full_name: driverData.full_name,
      avatar_url: getAvatarUrl(supabase, driverData.avatar_url) ?? null,
    },
  } as RideWithDriver;
}

export async function createRideOperation(
  context: RideOperationContext,
  rideData: CreateRideRequest,
  driverId: string
): Promise<Ride> {
  const { supabase } = context;

  if (rideData.price > MAX_RIDE_PRICE_FCFA) {
    throw new Error("Our price limit is 6000 FCFA per ride.");
  }

  const dropoffPoint = await validateAndResolveDropoffPoint(
    supabase,
    rideData.to_city,
    rideData.dropoff_point_id
  );

  const insertData: any = {
    driver_id: driverId,
    from_city: rideData.from_city,
    to_city: rideData.to_city,
    dropoff_point_id: dropoffPoint.id,
    dropoff_point_name: dropoffPoint.name,
    departure_time: rideData.departure_time,
    price: rideData.price,
    seats_available: rideData.seats_available,
    description: rideData.description,
    car_model: rideData.car_model,
    car_color: rideData.car_color,
  };

  if (rideData.pickup_points && rideData.pickup_points.length > 0) {
    insertData.pickup_points = rideData.pickup_points;
  }

  const { data, error } = await supabase
    .from("rides")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create ride: ${error.message}`);
  }

  let pickupPoints = undefined;
  if (data.pickup_points) {
    try {
      pickupPoints =
        typeof data.pickup_points === "string"
          ? JSON.parse(data.pickup_points)
          : data.pickup_points;
    } catch (e) {
      console.error("Error parsing pickup_points:", e);
    }
  }

  const { data: driverProfile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", driverId)
    .single();

  return {
    ...data,
    pickup_points: pickupPoints,
    driver: driverProfile || null,
  } as Ride;
}

export async function updateRideByDriverOperation(
  context: RideOperationContext,
  rideId: string,
  userId: string,
  updateData: UpdateRideRequest
): Promise<RideWithDetails> {
  const { supabase } = context;

  const { data: existingRide, error: checkError } = await supabase
    .from("rides")
    .select("driver_id, from_city, to_city, status")
    .eq("id", rideId)
    .single();

  if (checkError) {
    if (checkError.code === "PGRST116") {
      throw new RideApiError("Ride not found", 404);
    }
    throw new RideApiError("Failed to check ride", 500);
  }

  if (existingRide.driver_id !== userId) {
    throw new RideApiError(
      "Access denied. You can only update your own rides.",
      403
    );
  }

  if (existingRide.status === "cancelled") {
    throw new RideApiError(
      "This ride is cancelled and can no longer be updated.",
      400
    );
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, seats, payment_status, selected_pickup_point_id")
    .eq("ride_id", rideId);

  if (
    updateData.price !== undefined &&
    updateData.price > MAX_RIDE_PRICE_FCFA
  ) {
    throw new RideApiError("Our price limit is 6000 FCFA per ride.", 400);
  }

  const hasBookings = Array.isArray(bookings) && bookings.length > 0;
  const hasPaidBookings =
    hasBookings &&
    bookings!.some(
      (b: { payment_status?: string }) =>
        b.payment_status === "completed" || b.payment_status === "partial_refund"
    );
  const totalBookedSeats = hasBookings
    ? (bookings as { seats: number }[]).reduce((sum, b) => sum + (b.seats ?? 0), 0)
    : 0;
  const paidBookedSeats = hasBookings
    ? (bookings as { seats: number; payment_status?: string }[])
        .filter(
          (b) =>
            b.payment_status === "completed" || b.payment_status === "partial_refund"
        )
        .reduce((sum, b) => sum + (b.seats ?? 0), 0)
    : 0;

  if (hasPaidBookings) {
    if (
      updateData.from_city !== undefined ||
      updateData.to_city !== undefined ||
      updateData.dropoff_point_id !== undefined ||
      updateData.departure_time !== undefined ||
      updateData.price !== undefined
    ) {
      throw new RideApiError(
        "Only description, seats, and pickup points can be updated when a passenger has already paid.",
        400
      );
    }
    if (
      updateData.seats_available !== undefined &&
      updateData.seats_available < Math.max(totalBookedSeats, paidBookedSeats)
    ) {
      throw new RideApiError(
        `Cannot set seats below ${Math.max(totalBookedSeats, paidBookedSeats)} (already booked/paid).`,
        400
      );
    }
  } else if (hasBookings) {
    if (
      updateData.from_city !== undefined ||
      updateData.to_city !== undefined ||
      updateData.dropoff_point_id !== undefined ||
      updateData.departure_time !== undefined
    ) {
      throw new RideApiError(
        "Route, destination dropoff point, and departure time cannot be changed when the ride has bookings. You can still update price, seats, pickup points, and description.",
        400
      );
    }
    if (
      updateData.seats_available !== undefined &&
      updateData.seats_available < totalBookedSeats
    ) {
      throw new RideApiError(
        `Cannot set seats below ${totalBookedSeats} (already booked).`,
        400
      );
    }
  }

  const updateFields: Record<string, unknown> = {};
  if (updateData.from_city !== undefined) updateFields.from_city = updateData.from_city;
  if (updateData.to_city !== undefined) updateFields.to_city = updateData.to_city;
  if (updateData.to_city !== undefined && updateData.dropoff_point_id === undefined) {
    throw new RideApiError(
      "dropoff_point_id is required when destination city changes.",
      400
    );
  }
  if (updateData.dropoff_point_id !== undefined) {
    const toCity = (updateData.to_city ?? existingRide.to_city) as string;
    try {
      const dropoffPoint = await validateAndResolveDropoffPoint(
        supabase,
        toCity,
        updateData.dropoff_point_id
      );
      updateFields.dropoff_point_id = dropoffPoint.id;
      updateFields.dropoff_point_name = dropoffPoint.name;
    } catch (e) {
      throw new RideApiError(
        e instanceof Error ? e.message : "Invalid dropoff point",
        400
      );
    }
  }
  if (updateData.departure_time !== undefined)
    updateFields.departure_time = updateData.departure_time;
  if (updateData.price !== undefined) updateFields.price = updateData.price;
  if (updateData.seats_available !== undefined)
    updateFields.seats_available = updateData.seats_available;
  if (updateData.description !== undefined)
    updateFields.description = updateData.description;
  if (updateData.car_model !== undefined) updateFields.car_model = updateData.car_model;
  if (updateData.car_color !== undefined) updateFields.car_color = updateData.car_color;

  if (updateData.pickup_points !== undefined) {
    const fromCity = (updateData.from_city ?? existingRide.from_city) as string;
    try {
      const processed = await validateAndProcessPickupPoints(
        supabase,
        fromCity,
        updateData.pickup_points
      );
      const newPickupPointIds = new Set(
        (processed ?? []).map((p: { id: string }) => p.id)
      );
      if (hasPaidBookings && Array.isArray(bookings)) {
        const paidPickupIds = (
          bookings as { payment_status?: string; selected_pickup_point_id?: string }[]
        )
          .filter(
            (b) =>
              (b.payment_status === "completed" ||
                b.payment_status === "partial_refund") &&
              b.selected_pickup_point_id
          )
          .map((b) => b.selected_pickup_point_id as string);
        for (const id of paidPickupIds) {
          if (!newPickupPointIds.has(id)) {
            throw new RideApiError(
              "Cannot remove a pickup point chosen by a passenger who has already paid.",
              400
            );
          }
        }
      }
      updateFields.pickup_points = processed ?? [];
    } catch (e) {
      if (e instanceof RideApiError) throw e;
      throw new RideApiError(
        e instanceof Error ? e.message : "Invalid pickup points",
        400
      );
    }
  }

  if (Object.keys(updateFields).length === 0) {
    throw new RideApiError("No fields to update", 400);
  }

  const { data: updatedRide, error: updateError } = await supabase
    .from("rides")
    .update(updateFields)
    .eq("id", rideId)
    .select(`*, driver:profiles!rides_driver_id_fkey(id, full_name, avatar_url)`)
    .single();

  if (updateError) {
    throw new RideApiError("Failed to update ride", 500);
  }

  const enriched = await enrichRidePickupPointNames(
    supabase,
    updatedRide as RideWithPickupPoints
  );
  return enriched as unknown as RideWithDetails;
}

export async function updateRideOperation(
  context: RideOperationContext,
  rideId: string,
  updateData: UpdateRideRequest
): Promise<Ride> {
  const { supabase } = context;

  let validatedDropoffPoint: { id: string; name: string } | null = null;
  if (updateData.dropoff_point_id !== undefined) {
    const { data: existingRide, error: existingRideError } = await supabase
      .from("rides")
      .select("to_city")
      .eq("id", rideId)
      .single();

    if (existingRideError || !existingRide) {
      throw new Error("Failed to validate dropoff point");
    }

    const toCity = (updateData.to_city ?? existingRide.to_city) as string;
    validatedDropoffPoint = await validateAndResolveDropoffPoint(
      supabase,
      toCity,
      updateData.dropoff_point_id
    );
  }

  const updatePayload: any = {
    ...updateData,
    updated_at: new Date().toISOString(),
  };

  if (validatedDropoffPoint) {
    updatePayload.dropoff_point_id = validatedDropoffPoint.id;
    updatePayload.dropoff_point_name = validatedDropoffPoint.name;
  }

  if (updateData.pickup_points !== undefined) {
    updatePayload.pickup_points =
      updateData.pickup_points.length > 0 ? updateData.pickup_points : null;
  }

  const { data, error } = await supabase
    .from("rides")
    .update(updatePayload)
    .eq("id", rideId)
    .select(`
        *,
        driver:profiles!rides_driver_id_fkey(id, full_name, avatar_url)
      `)
    .single();

  if (error) {
    throw new Error(`Failed to update ride: ${error.message}`);
  }

  let pickupPoints = undefined;
  if (data.pickup_points) {
    try {
      pickupPoints =
        typeof data.pickup_points === "string"
          ? JSON.parse(data.pickup_points)
          : data.pickup_points;
    } catch (e) {
      console.error("Error parsing pickup_points:", e);
    }
  }

  return {
    ...data,
    pickup_points: pickupPoints,
  };
}

export async function deleteRideByDriverOperation(
  context: RideOperationContext,
  rideId: string,
  userId: string
): Promise<void> {
  const { supabase } = context;

  const { data: existingRide, error: checkError } = await supabase
    .from("rides")
    .select("driver_id")
    .eq("id", rideId)
    .single();

  if (checkError) {
    if (checkError.code === "PGRST116") {
      throw new RideApiError("Ride not found", 404);
    }
    throw new RideApiError("Failed to check ride", 500);
  }

  if (existingRide.driver_id !== userId) {
    throw new RideApiError(
      "Access denied. You can only delete your own rides.",
      403
    );
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("ride_id", rideId)
    .limit(1);

  if (bookingsError) {
    throw new RideApiError("Failed to check bookings", 500);
  }

  if (bookings && bookings.length > 0) {
    throw new RideApiError(
      "Cannot delete ride that has booking history. Cancel the ride instead.",
      400
    );
  }

  const { error: deleteError } = await supabase
    .from("rides")
    .delete()
    .eq("id", rideId);

  if (deleteError) {
    throw new RideApiError("Failed to delete ride", 500);
  }
}

export async function deleteRideOperation(
  context: RideOperationContext,
  rideId: string
): Promise<void> {
  const { supabase } = context;

  const { error } = await supabase.from("rides").delete().eq("id", rideId);

  if (error) {
    throw new Error(`Failed to delete ride: ${error.message}`);
  }
}

