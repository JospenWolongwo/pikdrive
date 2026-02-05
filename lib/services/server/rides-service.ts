import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Ride,
  RideWithDetails,
  RideWithDriver,
  CreateRideRequest,
  UpdateRideRequest,
} from '@/types';
import {
  enrichRidePickupPointNames,
  type RideWithPickupPoints,
} from './enrich-ride-pickup-point-names';
import { validateAndProcessPickupPoints } from './validate-ride-pickup-points';
import { getAvatarUrl } from '@/lib/utils/avatar-url';

/** Thrown by API-oriented methods; route handlers map statusCode to HTTP status */
export class RideApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'RideApiError';
  }
}

/**
 * Server-side RidesService for use in API routes
 * Uses direct Supabase client access (no HTTP calls)
 */
export class ServerRidesService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get all rides with filtering and pagination
   */
  async getRides(params?: {
    driver_id?: string;
    from_city?: string;
    to_city?: string;
    min_price?: number;
    max_price?: number;
    min_seats?: number;
    upcoming?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('rides')
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url),
        bookings(id, seats, status, payment_status)
      `)
      .order('departure_time', { ascending: true });

    // Apply filters
    if (params?.driver_id) {
      query = query.eq('driver_id', params.driver_id);
    }
    if (params?.from_city && params.from_city !== 'any') {
      query = query.eq('from_city', params.from_city);
    }
    if (params?.to_city && params.to_city !== 'any') {
      query = query.eq('to_city', params.to_city);
    }
    if (params?.min_price) {
      query = query.gte('price', params.min_price);
    }
    if (params?.max_price) {
      query = query.lte('price', params.max_price);
    }
    if (params?.min_seats) {
      query = query.gte('seats_available', params.min_seats);
    }
    if (params?.upcoming) {
      query = query.gt('departure_time', new Date().toISOString());
    }

    // Get total count
    let countQuery = this.supabase
      .from('rides')
      .select('*', { count: 'exact', head: true });

    // Apply same filters to count query
    if (params?.driver_id) countQuery = countQuery.eq('driver_id', params.driver_id);
    if (params?.from_city && params.from_city !== 'any') countQuery = countQuery.eq('from_city', params.from_city);
    if (params?.to_city && params.to_city !== 'any') countQuery = countQuery.eq('to_city', params.to_city);
    if (params?.min_price) countQuery = countQuery.gte('price', params.min_price);
    if (params?.max_price) countQuery = countQuery.lte('price', params.max_price);
    if (params?.min_seats) countQuery = countQuery.gte('seats_available', params.min_seats);
    if (params?.upcoming) countQuery = countQuery.gt('departure_time', new Date().toISOString());

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`Failed to get ride count: ${countError.message}`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: rides, error: ridesError } = await query;

    if (ridesError) {
      throw new Error(`Failed to fetch rides: ${ridesError.message}`);
    }

    // Fetch vehicle images for all drivers
    const driverIds = [...new Set((rides || []).map((ride: any) => ride.driver_id))];
    
    const { data: driverDocuments } = await this.supabase
      .from('driver_documents')
      .select('driver_id, vehicle_images')
      .in('driver_id', driverIds);

    // Create a map of driver_id to vehicle_images
    const vehicleImagesMap = new Map<string, string[]>();
    if (driverDocuments) {
      driverDocuments.forEach((doc: any) => {
        if (doc.vehicle_images && doc.vehicle_images.length > 0) {
          vehicleImagesMap.set(doc.driver_id, doc.vehicle_images);
        }
      });
    }

    // Merge vehicle images with rides data, parse pickup_points, resolve avatar URL
    const ridesMerged = (rides || []).map((ride: any) => {
      const vehicleImages = vehicleImagesMap.get(ride.driver_id) || [];
      let pickupPoints: unknown = undefined;
      if (ride.pickup_points) {
        try {
          pickupPoints = typeof ride.pickup_points === 'string'
            ? JSON.parse(ride.pickup_points)
            : ride.pickup_points;
        } catch (e) {
          console.error('Error parsing pickup_points:', e);
        }
      }
      const driver = ride.driver
        ? {
            ...ride.driver,
            avatar_url: getAvatarUrl(this.supabase, ride.driver.avatar_url) ?? null,
            vehicle_images: vehicleImages,
          }
        : null;
      return {
        ...ride,
        pickup_points: pickupPoints,
        driver,
      };
    });

    const data = await enrichRidePickupPointNames(this.supabase, ridesMerged);
    const totalPages = Math.ceil((count || 0) / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: totalPages,
      },
    };
  }

  /**
   * Get ride by ID with full details
   */
  async getRideById(rideId: string): Promise<RideWithDetails | null> {
    const { data, error } = await this.supabase
      .from('rides')
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url, phone),
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
      .eq('id', rideId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Ride not found
      }
      throw new Error(`Failed to fetch ride: ${error.message}`);
    }

    return data;
  }

  /**
   * Get ride by ID for API: driver + bookings with user profiles and enriched pickup names.
   * Throws RideApiError(404) if not found.
   */
  async getRideByIdForApi(rideId: string): Promise<RideWithDetails> {
    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
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
          selected_pickup_point_id,
          created_at
        )
      `)
      .eq('id', rideId)
      .single();

    if (rideError) {
      if (rideError.code === 'PGRST116') {
        throw new RideApiError('Ride not found', 404);
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
          enrichedRide.bookings.map((b: { user_id: string }) => b.user_id).filter(Boolean)
        ),
      ];
      const fallbackUser = {
        full_name: 'Utilisateur inconnu',
        avatar_url: null,
      };

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await this.supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        if (profilesError) {
          enrichedRide.bookings = enrichedRide.bookings.map(
            (booking: { user_id: string }) => ({
              ...booking,
              user: { id: booking.user_id || '', ...fallbackUser },
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
            user: { id: booking.user_id || '', ...fallbackUser },
          })
        );
      }
    }

    return enrichRidePickupPointNames(this.supabase, enrichedRide);
  }

  /**
   * Create ride for API: verifies driver role, validates input and pickup points, inserts and returns enriched ride.
   * Throws RideApiError(403|400|500) as appropriate.
   */
  async createRideForApi(
    userId: string,
    rideData: CreateRideRequest
  ): Promise<RideWithDriver> {
    const { data: driverData, error: driverError } = await this.supabase
      .from('profiles')
      .select('id, full_name, avatar_url, is_driver')
      .eq('id', userId)
      .single();

    if (driverError || !driverData?.is_driver) {
      throw new RideApiError('Access denied. Driver role required.', 403);
    }

    if (
      !rideData.from_city ||
      !rideData.to_city ||
      !rideData.departure_time ||
      rideData.price == null ||
      rideData.seats_available == null
    ) {
      throw new RideApiError('Missing required fields', 400);
    }

    let processedPickupPoints: { id: string; order: number; time_offset_minutes: number }[] | null = null;
    try {
      processedPickupPoints = await validateAndProcessPickupPoints(
        this.supabase,
        rideData.from_city,
        rideData.pickup_points
      );
    } catch (e) {
      throw new RideApiError(
        e instanceof Error ? e.message : 'Invalid pickup points',
        400
      );
    }

    const insertData: Record<string, unknown> = {
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
    if (processedPickupPoints) {
      insertData.pickup_points = processedPickupPoints;
    }

    const { data: ride, error: createError } = await this.supabase
      .from('rides')
      .insert(insertData)
      .select('*')
      .single();

    if (createError) {
      throw new RideApiError('Failed to create ride', 500);
    }

    const rideEnriched = await enrichRidePickupPointNames(
      this.supabase,
      ride as RideWithPickupPoints
    );
    return {
      ...rideEnriched,
      driver: {
        id: driverData.id,
        full_name: driverData.full_name,
        avatar_url: getAvatarUrl(this.supabase, driverData.avatar_url) ?? null,
      },
    } as RideWithDriver;
  }

  /**
   * Create a new ride
   */
  async createRide(rideData: CreateRideRequest, driverId: string): Promise<Ride> {
    const insertData: any = {
      driver_id: driverId,
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
    if (rideData.pickup_points && rideData.pickup_points.length > 0) {
      insertData.pickup_points = rideData.pickup_points;
    }

    const { data, error } = await this.supabase
      .from('rides')
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create ride: ${error.message}`);
    }

    // Parse pickup_points JSONB if present
    let pickupPoints = undefined;
    if (data.pickup_points) {
      try {
        pickupPoints = typeof data.pickup_points === 'string'
          ? JSON.parse(data.pickup_points)
          : data.pickup_points;
      } catch (e) {
        console.error('Error parsing pickup_points:', e);
      }
    }

    // Fetch driver profile separately (avoids PostgREST relationship syntax issues)
    const { data: driverProfile } = await this.supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", driverId)
      .single();

    // Attach driver profile to ride
    return {
      ...data,
      pickup_points: pickupPoints,
      driver: driverProfile || null,
    } as Ride;
  }

  /**
   * Update ride by driver: checks ownership, validates pickup_points, updates and returns enriched ride.
   * Throws RideApiError(404|403|400|500) as appropriate.
   */
  async updateRideByDriver(
    rideId: string,
    userId: string,
    updateData: UpdateRideRequest
  ): Promise<RideWithDetails> {
    const { data: existingRide, error: checkError } = await this.supabase
      .from('rides')
      .select('driver_id, from_city')
      .eq('id', rideId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        throw new RideApiError('Ride not found', 404);
      }
      throw new RideApiError('Failed to check ride', 500);
    }

    if (existingRide.driver_id !== userId) {
      throw new RideApiError(
        'Access denied. You can only update your own rides.',
        403
      );
    }

    const { data: bookings } = await this.supabase
      .from('bookings')
      .select('id, seats, payment_status, selected_pickup_point_id')
      .eq('ride_id', rideId);

    const hasBookings = Array.isArray(bookings) && bookings.length > 0;
    const hasPaidBookings =
      hasBookings &&
      bookings!.some((b: { payment_status?: string }) => b.payment_status === 'completed');
    const totalBookedSeats = hasBookings
      ? (bookings as { seats: number }[]).reduce((sum, b) => sum + (b.seats ?? 0), 0)
      : 0;

    if (hasPaidBookings) {
      if (
        updateData.from_city !== undefined ||
        updateData.to_city !== undefined ||
        updateData.departure_time !== undefined ||
        updateData.price !== undefined ||
        updateData.seats_available !== undefined
      ) {
        throw new RideApiError(
          'Only description and pickup points can be updated when a passenger has already paid.',
          400
        );
      }
    } else if (hasBookings) {
      if (
        updateData.from_city !== undefined ||
        updateData.to_city !== undefined ||
        updateData.departure_time !== undefined
      ) {
        throw new RideApiError(
          'Route and departure time cannot be changed when the ride has bookings. You can still update price, seats, pickup points, and description.',
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
          this.supabase,
          fromCity,
          updateData.pickup_points
        );
        const newPickupPointIds = new Set(
          (processed ?? []).map((p: { id: string }) => p.id)
        );
        if (hasPaidBookings && Array.isArray(bookings)) {
          const paidPickupIds = (bookings as { payment_status?: string; selected_pickup_point_id?: string }[])
            .filter((b) => b.payment_status === 'completed' && b.selected_pickup_point_id)
            .map((b) => b.selected_pickup_point_id as string);
          for (const id of paidPickupIds) {
            if (!newPickupPointIds.has(id)) {
              throw new RideApiError(
                'Cannot remove a pickup point chosen by a passenger who has already paid.',
                400
              );
            }
          }
        }
        updateFields.pickup_points = processed ?? [];
      } catch (e) {
        if (e instanceof RideApiError) throw e;
        throw new RideApiError(
          e instanceof Error ? e.message : 'Invalid pickup points',
          400
        );
      }
    }

    if (Object.keys(updateFields).length === 0) {
      throw new RideApiError('No fields to update', 400);
    }

    const { data: updatedRide, error: updateError } = await this.supabase
      .from('rides')
      .update(updateFields)
      .eq('id', rideId)
      .select(`*, driver:profiles(id, full_name, avatar_url)`)
      .single();

    if (updateError) {
      throw new RideApiError('Failed to update ride', 500);
    }

    const enriched = await enrichRidePickupPointNames(
      this.supabase,
      updatedRide as RideWithPickupPoints
    );
    return enriched as unknown as RideWithDetails;
  }

  /**
   * Update an existing ride
   */
  async updateRide(rideId: string, updateData: UpdateRideRequest): Promise<Ride> {
    const updatePayload: any = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // Handle pickup_points separately if provided
    if (updateData.pickup_points !== undefined) {
      updatePayload.pickup_points = updateData.pickup_points.length > 0 
        ? updateData.pickup_points 
        : null;
    }

    const { data, error } = await this.supabase
      .from('rides')
      .update(updatePayload)
      .eq('id', rideId)
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update ride: ${error.message}`);
    }

    // Parse pickup_points JSONB if present
    let pickupPoints = undefined;
    if (data.pickup_points) {
      try {
        pickupPoints = typeof data.pickup_points === 'string'
          ? JSON.parse(data.pickup_points)
          : data.pickup_points;
      } catch (e) {
        console.error('Error parsing pickup_points:', e);
      }
    }

    return {
      ...data,
      pickup_points: pickupPoints,
    };
  }

  /**
   * Delete ride by driver: checks ownership and that there are no confirmed/pending bookings.
   * Throws RideApiError(404|403|400|500) as appropriate.
   */
  async deleteRideByDriver(rideId: string, userId: string): Promise<void> {
    const { data: existingRide, error: checkError } = await this.supabase
      .from('rides')
      .select('driver_id')
      .eq('id', rideId)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        throw new RideApiError('Ride not found', 404);
      }
      throw new RideApiError('Failed to check ride', 500);
    }

    if (existingRide.driver_id !== userId) {
      throw new RideApiError(
        'Access denied. You can only delete your own rides.',
        403
      );
    }

    const { data: bookings, error: bookingsError } = await this.supabase
      .from('bookings')
      .select('id, status')
      .eq('ride_id', rideId)
      .in('status', ['confirmed', 'pending']);

    if (bookingsError) {
      throw new RideApiError('Failed to check bookings', 500);
    }

    if (bookings && bookings.length > 0) {
      throw new RideApiError(
        'Cannot delete ride with confirmed or pending bookings',
        400
      );
    }

    const { error: deleteError } = await this.supabase
      .from('rides')
      .delete()
      .eq('id', rideId);

    if (deleteError) {
      throw new RideApiError('Failed to delete ride', 500);
    }
  }

  /**
   * Delete a ride
   */
  async deleteRide(rideId: string): Promise<void> {
    const { error } = await this.supabase
      .from('rides')
      .delete()
      .eq('id', rideId);

    if (error) {
      throw new Error(`Failed to delete ride: ${error.message}`);
    }
  }

  /**
   * Get rides for a specific driver
   */
  async getDriverRides(driverId: string, params?: {
    upcoming?: boolean;
    past?: boolean;
  }): Promise<RideWithDetails[]> {
    let query = this.supabase
      .from('rides')
      .select('id')
      .eq('driver_id', driverId)
      .order('departure_time', { ascending: true });

    // Apply time filters if specified
    if (params?.upcoming) {
      query = query.gt('departure_time', new Date().toISOString());
    } else if (params?.past) {
      query = query.lte('departure_time', new Date().toISOString());
    }

    const { data: rides, error: ridesError } = await query;

    if (ridesError) {
      throw new Error(`Failed to fetch driver rides: ${ridesError.message}`);
    }

    if (!rides || rides.length === 0) {
      return [];
    }

    // Fetch full details for each ride
    const rideIds = rides.map((r: any) => r.id);
    
    const { data: detailedRides, error: detailsError } = await this.supabase
      .from('rides')
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url, phone),
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
      .in('id', rideIds)
      .order('departure_time', { ascending: true });

    if (detailsError) {
      throw new Error(`Failed to fetch ride details: ${detailsError.message}`);
    }

    // Filter out cancelled bookings from nested relation
    // Note: Supabase doesn't support filtering nested relations in select,
    // so we filter after fetching for this query structure
    const filteredRides = (detailedRides || []).map((ride: any) => ({
      ...ride,
      bookings: (ride.bookings || []).filter((booking: any) => booking.status !== 'cancelled')
    }));

    return filteredRides;
  }

  /**
   * Get user rides (both as driver and passenger)
   */
  async getUserRides(userId: string): Promise<Ride[]> {
    // Get rides where user is the driver
    const { data: driverRides, error: driverError } = await this.supabase
      .from('rides')
      .select('*')
      .eq('driver_id', userId)
      .order('departure_time', { ascending: false });

    if (driverError) {
      throw new Error(`Failed to fetch driver rides: ${driverError.message}`);
    }

    // Get rides where user has bookings (as passenger)
    const { data: bookings, error: bookingsError } = await this.supabase
      .from('bookings')
      .select('ride_id')
      .eq('user_id', userId);

    if (bookingsError) {
      throw new Error(`Failed to fetch user bookings: ${bookingsError.message}`);
    }

    const passengerRideIds = bookings?.map((b: any) => b.ride_id) || [];

    if (passengerRideIds.length === 0) {
      return driverRides || [];
    }

    const { data: passengerRides, error: passengerError } = await this.supabase
      .from('rides')
      .select('*')
      .in('id', passengerRideIds)
      .order('departure_time', { ascending: false });

    if (passengerError) {
      throw new Error(`Failed to fetch passenger rides: ${passengerError.message}`);
    }

    // Combine and deduplicate
    const allRides = [...(driverRides || []), ...(passengerRides || [])];
    const uniqueRides = Array.from(
      new Map(allRides.map((ride: any) => [ride.id, ride])).values()
    );

    return uniqueRides;
  }
}
