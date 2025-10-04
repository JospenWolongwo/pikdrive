import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Booking, 
  CreateBookingRequest, 
  UpdateBookingRequest,
  BookingWithDetails,
  DriverBooking 
} from '@/types';

export interface BookingSearchParams {
  userId?: string;
  rideId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Server-side BookingService for use in API routes
 * Uses direct Supabase client access (no HTTP calls)
 */
export class ServerBookingService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create or update a booking (upsert)
   */
  async createBooking(params: CreateBookingRequest & { user_id: string }): Promise<Booking> {
    try {
      // Use upsert to handle the unique constraint gracefully
      // This will either insert a new booking or update existing one
      const { data: booking, error: upsertError } = await this.supabase
        .from('bookings')
        .upsert({
          ride_id: params.ride_id,
          user_id: params.user_id,
          seats: params.seats,
          status: 'pending',
          payment_status: 'pending',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'ride_id,user_id', // Handle the unique constraint
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (upsertError) {
        console.error('ServerBookingService.createBooking upsert error:', upsertError);
        throw new Error(`Failed to create/update booking: ${upsertError.message}`);
      }

      return booking;
    } catch (error) {
      console.error('ServerBookingService.createBooking error:', error);
      throw error;
    }
  }

  /**
   * Get bookings for a user
   */
  async getUserBookings(params: BookingSearchParams): Promise<BookingWithDetails[]> {
    try {
      // First, get the bookings
      const { data: bookingsData, error: bookingsError } = await this.supabase
        .from('bookings')
        .select(`
          *,
          ride:ride_id (
            *,
            driver:driver_id (
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', params.userId!)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw new Error(`Failed to fetch user bookings: ${bookingsError.message}`);
      }

      if (!bookingsData || bookingsData.length === 0) {
        return [];
      }

      // Get user profile information separately
      const { data: userProfile, error: userError } = await this.supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', params.userId!)
        .single();

      if (userError) {
        console.warn('Could not fetch user profile:', userError.message);
      }

      // Combine the data
      const enrichedBookings = bookingsData.map(booking => ({
        ...booking,
        user: userProfile || { id: params.userId!, full_name: 'Unknown User', avatar_url: null }
      }));

      return enrichedBookings;
    } catch (error) {
      console.error('ServerBookingService.getUserBookings error:', error);
      throw error;
    }
  }

  /**
   * Get bookings for a driver
   */
  async getDriverBookings(params: BookingSearchParams): Promise<DriverBooking[]> {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .select(`
          *,
          user:user_id (
            id,
            full_name,
            avatar_url,
            phone
          ),
          ride:ride_id (
            id,
            from_city,
            to_city,
            departure_time,
            price
          )
        `)
        .eq('ride.driver_id', params.userId!)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch driver bookings: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('ServerBookingService.getDriverBookings error:', error);
      throw error;
    }
  }

  /**
   * Update booking
   */
  async updateBooking(bookingId: string, params: UpdateBookingRequest): Promise<Booking> {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .update({
          ...params,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update booking: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerBookingService.updateBooking error:', error);
      throw error;
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string): Promise<void> {
    try {
      const { error } = await this.supabase.rpc(
        'cancel_booking_and_restore_seats',
        { p_booking_id: bookingId }
      );

      if (error) {
        throw new Error(`Failed to cancel booking: ${error.message}`);
      }
    } catch (error) {
      console.error('ServerBookingService.cancelBooking error:', error);
      throw error;
    }
  }

  /**
   * Verify booking code (driver only)
   */
  async verifyBookingCode(bookingId: string, verificationCode: string): Promise<boolean> {
    try {
      const { data: isValid, error } = await this.supabase.rpc(
        'verify_booking_code',
        { 
          booking_id: bookingId,
          submitted_code: verificationCode 
        }
      );

      if (error) {
        throw new Error(`Failed to verify booking code: ${error.message}`);
      }

      return isValid;
    } catch (error) {
      console.error('ServerBookingService.verifyBookingCode error:', error);
      throw error;
    }
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<BookingWithDetails | null> {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .select(`
          *,
          ride:ride_id (
            *,
            driver:driver_id (
              id,
              full_name,
              avatar_url
            )
          ),
          user:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Booking not found
        }
        throw new Error(`Failed to fetch booking: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerBookingService.getBookingById error:', error);
      throw error;
    }
  }

  /**
   * Check if user has existing booking for a ride
   */
  async getExistingBookingForRide(rideId: string, userId: string): Promise<Booking | null> {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .select('*')
        .eq('ride_id', rideId)
        .eq('user_id', userId)
        .in('status', ['pending', 'pending_verification', 'confirmed'])
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No existing booking
        }
        throw new Error(`Failed to check existing booking: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerBookingService.getExistingBookingForRide error:', error);
      throw error;
    }
  }
}
