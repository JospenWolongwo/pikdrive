import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Booking, 
  CreateBookingRequest, 
  UpdateBookingRequest,
  BookingWithDetails,
  DriverBooking,
  PickupPoint
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
   * Validate and calculate pickup point information
   */
  private async validateAndCalculatePickupPoint(
    rideId: string,
    selectedPickupPointId: string | undefined
  ): Promise<{ pickup_point_name?: string; pickup_time?: string } | null> {
    if (!selectedPickupPointId) {
      return null;
    }

    // Fetch ride to get pickup_points
    const { data: ride, error: rideError } = await this.supabase
      .from('rides')
      .select('departure_time, pickup_points')
      .eq('id', rideId)
      .single();

    if (rideError || !ride) {
      throw new Error('Ride not found');
    }

    // Parse pickup_points
    let pickupPoints: PickupPoint[] | undefined;
    if (ride.pickup_points) {
      try {
        pickupPoints = typeof ride.pickup_points === 'string'
          ? JSON.parse(ride.pickup_points)
          : ride.pickup_points;
      } catch (e) {
        console.error('Error parsing pickup_points:', e);
        throw new Error('Invalid pickup points data in ride');
      }
    }

    // Validate pickup point exists
    if (!pickupPoints || pickupPoints.length === 0) {
      throw new Error('Ride has no pickup points defined');
    }

    const selectedPoint = pickupPoints.find(p => p.id === selectedPickupPointId);
    if (!selectedPoint) {
      throw new Error('Selected pickup point not found in ride');
    }

    // Calculate pickup time: departure_time + time_offset_minutes
    const departureTime = new Date(ride.departure_time);
    const pickupTimeDate = new Date(
      departureTime.getTime() + selectedPoint.time_offset_minutes * 60 * 1000
    );

    return {
      pickup_point_name: selectedPoint.name,
      pickup_time: pickupTimeDate.toISOString(),
    };
  }

  /**
   * Create or update a booking (upsert)
   * Uses atomic seat reservation to prevent race conditions
   * Supports both creating new bookings and updating existing ones
   */
  async createBooking(params: CreateBookingRequest & { 
    user_id: string;
    selected_pickup_point_id?: string;
  }): Promise<Booking> {
    try {
      // First, check if user already has a booking for this ride
      const { data: existingBooking } = await this.supabase
        .from('bookings')
        .select('id, seats, status, payment_status')
        .eq('ride_id', params.ride_id)
        .eq('user_id', params.user_id)
        .not('status', 'in', '(cancelled,completed)')
        .maybeSingle();

      // Use atomic seat reservation function
      // Always call with 4 parameters to avoid PostgreSQL function ambiguity
      // Pass null for p_booking_id when creating, existing booking id when updating
      let reservationResult, reservationError;
      
      if (existingBooking) {
        // UPDATE MODE: Pass existing booking ID
        console.log('🔍 [BOOKING SERVICE] Updating booking:', {
          bookingId: existingBooking.id,
          oldSeats: existingBooking.seats,
          newSeats: params.seats
        });
        
        ({ data: reservationResult, error: reservationError } = await this.supabase.rpc(
          'reserve_ride_seats',
          {
            p_ride_id: params.ride_id,
            p_user_id: params.user_id,
            p_seats: params.seats,
            p_booking_id: existingBooking.id
          }
        ));
      } else {
        // CREATE MODE: Explicitly pass null to avoid function signature ambiguity
        console.log('🔍 [BOOKING SERVICE] Creating new booking');
        
        ({ data: reservationResult, error: reservationError } = await this.supabase.rpc(
          'reserve_ride_seats',
          {
            p_ride_id: params.ride_id,
            p_user_id: params.user_id,
            p_seats: params.seats,
            p_booking_id: null
          }
        ));
      }

      if (reservationError) {
        console.error('❌ Atomic seat reservation error:', reservationError);
        throw new Error(`Failed to reserve seats: ${reservationError.message}`);
      }

      const result = reservationResult?.[0];
      
      if (!result?.success) {
        const errorMsg = result?.error_message || 'Failed to reserve seats';
        console.error('❌ Seat reservation failed:', errorMsg);
        throw new Error(errorMsg);
      }

      if (!result.booking_id) {
        throw new Error('Booking created but no ID returned');
      }

      console.log(`✅ Seats ${existingBooking ? 'updated' : 'reserved'} atomically:`, {
        bookingId: result.booking_id,
        rideId: params.ride_id,
        seats: params.seats,
        oldSeats: existingBooking?.seats,
        mode: existingBooking ? 'UPDATE' : 'CREATE'
      });

      // Fetch the created/updated booking
      const { data: booking, error: fetchError } = await this.supabase
        .from('bookings')
        .select('*')
        .eq('id', result.booking_id)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching booking:', fetchError);
        throw new Error(`Failed to fetch booking: ${fetchError.message}`);
      }

      // Validate and calculate pickup point information if provided
      let pickupPointInfo: { pickup_point_name?: string; pickup_time?: string } | null = null;
      if (params.selected_pickup_point_id) {
        try {
          pickupPointInfo = await this.validateAndCalculatePickupPoint(
            params.ride_id,
            params.selected_pickup_point_id
          );
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to validate pickup point');
        }
      }

      // Update booking with pickup point information if provided
      if (pickupPointInfo) {
        const { data: updatedBooking, error: updateError } = await this.supabase
          .from('bookings')
          .update({
            selected_pickup_point_id: params.selected_pickup_point_id || null,
            pickup_point_name: pickupPointInfo.pickup_point_name || null,
            pickup_time: pickupPointInfo.pickup_time || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', result.booking_id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating booking with pickup point:', updateError);
          // Don't throw - continue with original booking
        } else if (updatedBooking) {
          // Use updated booking for reconciliation check
          Object.assign(booking, updatedBooking);
        }
      }

      // RECONCILIATION: Check if there's already a completed payment for this booking
      // This handles race condition where payment completed before booking was created
      // The payment callback may have failed to update booking_status because booking didn't exist yet
      const { data: completedPayment } = await this.supabase
        .from('payments')
        .select('id, status, amount')
        .eq('booking_id', result.booking_id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (completedPayment && booking.payment_status !== 'completed') {
        console.log('🔄 [BOOKING SERVICE] Reconciling booking with completed payment:', {
          bookingId: result.booking_id,
          paymentId: completedPayment.id,
          currentPaymentStatus: booking.payment_status,
          reconcilingTo: 'completed'
        });

        // Update booking to match completed payment status
        // This will trigger the seat decrement via the database trigger
        const { data: updatedBooking, error: updateError } = await this.supabase
          .from('bookings')
          .update({
            payment_status: 'completed',
            status: 'pending_verification',
            updated_at: new Date().toISOString()
          })
          .eq('id', result.booking_id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ [BOOKING SERVICE] Error reconciling booking payment status:', updateError);
          // Don't throw - return the original booking to avoid breaking the flow
          // The reconciliation can be retried later if needed
        } else {
          console.log('✅ [BOOKING SERVICE] Booking reconciled successfully:', {
            bookingId: result.booking_id,
            paymentStatus: updatedBooking?.payment_status,
            status: updatedBooking?.status
          });
          return updatedBooking!;
        }
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

  /**
   * Calculate payment amount for booking update
   * Returns amount for additional seats only if booking is already paid, otherwise full amount
   */
  async calculateAdditionalPaymentAmount(bookingId: string, newSeats: number): Promise<number> {
    try {
      // Fetch booking with ride details
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select(`
          id,
          seats,
          payment_status,
          ride_id,
          ride:rides!inner(price)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error(`Booking not found: ${bookingError?.message || 'Unknown error'}`);
      }

      const currentSeats = booking.seats;
      const paymentStatus = booking.payment_status;
      const ridePrice = (booking.ride as any)?.price;

      if (!ridePrice) {
        throw new Error('Ride price not found');
      }

      // If booking is already paid/completed and adding seats, calculate for additional seats only
      if (paymentStatus === 'completed') {
        if (newSeats <= currentSeats) {
          throw new Error('Cannot reduce seats on a paid booking');
        }
        const additionalSeats = newSeats - currentSeats;
        return additionalSeats * ridePrice;
      }

      // For unpaid bookings, return full amount
      return newSeats * ridePrice;
    } catch (error) {
      console.error('ServerBookingService.calculateAdditionalPaymentAmount error:', error);
      throw error;
    }
  }
}
