import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Ride, 
  RideWithDetails, 
  RideWithDriver,
  CreateRideRequest, 
  UpdateRideRequest 
} from '@/types';

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

    return {
      data: ridesWithVehicleImages,
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
   * Create a new ride
   */
  async createRide(rideData: CreateRideRequest, driverId: string): Promise<Ride> {
    const { data, error } = await this.supabase
      .from('rides')
      .insert({
        driver_id: driverId,
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

    if (error) {
      throw new Error(`Failed to create ride: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing ride
   */
  async updateRide(rideId: string, updateData: UpdateRideRequest): Promise<Ride> {
    const { data, error } = await this.supabase
      .from('rides')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rideId)
      .select(`
        *,
        driver:profiles(id, full_name, avatar_url)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update ride: ${error.message}`);
    }

    return data;
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
