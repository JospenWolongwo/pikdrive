import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Booking,
  CreateBookingRequest,
  UpdateBookingRequest,
  BookingWithDetails,
  DriverBooking,
} from '@/types';
import { validateAndCalculatePickupPoint } from './booking-helpers';
import type { BookingSearchParams } from './booking-types';

export class ServerBookingCoreService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create or update a booking (upsert)
   * Uses atomic seat reservation to prevent race conditions
   * Supports both creating new bookings and updating existing ones
   */
  async createBooking(
    params: CreateBookingRequest & {
      user_id: string;
      selected_pickup_point_id?: string;
    }
  ): Promise<Booking> {
    try {
      const { data: ride, error: rideError } = await this.supabase
        .from('rides')
        .select('id, status')
        .eq('id', params.ride_id)
        .maybeSingle();

      if (rideError) {
        throw new Error(`Failed to fetch ride: ${rideError.message}`);
      }

      if (!ride) {
        throw new Error('Ride not found');
      }

      if ((ride as { status?: string }).status === 'cancelled') {
        throw new Error('This ride has been cancelled by the driver');
      }

      const { data: existingBooking } = await this.supabase
        .from('bookings')
        .select('id, seats, status, payment_status')
        .eq('ride_id', params.ride_id)
        .eq('user_id', params.user_id)
        .not('status', 'in', '(cancelled,completed)')
        .maybeSingle();

      let reservationResult, reservationError;

      if (existingBooking) {
        console.log('ðŸ” [BOOKING SERVICE] Updating booking:', {
          bookingId: existingBooking.id,
          oldSeats: existingBooking.seats,
          newSeats: params.seats,
        });

        ({ data: reservationResult, error: reservationError } =
          await this.supabase.rpc('reserve_ride_seats', {
            p_ride_id: params.ride_id,
            p_user_id: params.user_id,
            p_seats: params.seats,
            p_booking_id: existingBooking.id,
          }));
      } else {
        console.log('ðŸ” [BOOKING SERVICE] Creating new booking');

        ({ data: reservationResult, error: reservationError } =
          await this.supabase.rpc('reserve_ride_seats', {
            p_ride_id: params.ride_id,
            p_user_id: params.user_id,
            p_seats: params.seats,
            p_booking_id: null,
          }));
      }

      if (reservationError) {
        console.error('âŒ Atomic seat reservation error:', reservationError);
        throw new Error(`Failed to reserve seats: ${reservationError.message}`);
      }

      const result = reservationResult?.[0];

      if (!result?.success) {
        const errorMsg = result?.error_message || 'Failed to reserve seats';
        console.error('âŒ Seat reservation failed:', errorMsg);
        throw new Error(errorMsg);
      }

      if (!result.booking_id) {
        throw new Error('Booking created but no ID returned');
      }

      console.log(`âœ… Seats ${existingBooking ? 'updated' : 'reserved'} atomically:`, {
        bookingId: result.booking_id,
        rideId: params.ride_id,
        seats: params.seats,
        oldSeats: existingBooking?.seats,
        mode: existingBooking ? 'UPDATE' : 'CREATE',
      });

      const { data: booking, error: fetchError } = await this.supabase
        .from('bookings')
        .select('*')
        .eq('id', result.booking_id)
        .single();

      if (fetchError) {
        console.error('âŒ Error fetching booking:', fetchError);
        throw new Error(`Failed to fetch booking: ${fetchError.message}`);
      }

      let pickupPointInfo:
        | { pickup_point_name?: string; pickup_time?: string }
        | null = null;
      if (params.selected_pickup_point_id) {
        try {
          pickupPointInfo = await validateAndCalculatePickupPoint(
            this.supabase,
            params.ride_id,
            params.selected_pickup_point_id
          );
        } catch (error) {
          throw new Error(
            error instanceof Error ? error.message : 'Failed to validate pickup point'
          );
        }
      }

      if (pickupPointInfo) {
        const { data: updatedBooking, error: updateError } = await this.supabase
          .from('bookings')
          .update({
            selected_pickup_point_id: params.selected_pickup_point_id || null,
            pickup_point_name: pickupPointInfo.pickup_point_name || null,
            pickup_time: pickupPointInfo.pickup_time || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.booking_id)
          .select()
          .single();

        if (updateError) {
          console.error('âŒ Error updating booking with pickup point:', updateError);
        } else if (updatedBooking) {
          Object.assign(booking, updatedBooking);
        }
      }

      const { data: completedPayment } = await this.supabase
        .from('payments')
        .select('id, status, amount')
        .eq('booking_id', result.booking_id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (
        completedPayment &&
        booking.payment_status !== 'completed' &&
        booking.payment_status !== 'partial_refund'
      ) {
        console.log('ðŸ”„ [BOOKING SERVICE] Reconciling booking with completed payment:', {
          bookingId: result.booking_id,
          paymentId: completedPayment.id,
          currentPaymentStatus: booking.payment_status,
          reconcilingTo: 'completed',
        });

        const { data: updatedBooking, error: updateError } = await this.supabase
          .from('bookings')
          .update({
            payment_status: 'completed',
            status: 'pending_verification',
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.booking_id)
          .select()
          .single();

        if (updateError) {
          console.error(
            'âŒ [BOOKING SERVICE] Error reconciling booking payment status:',
            updateError
          );
        } else {
          console.log('âœ… [BOOKING SERVICE] Booking reconciled successfully:', {
            bookingId: result.booking_id,
            paymentStatus: updatedBooking?.payment_status,
            status: updatedBooking?.status,
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
      const { data: bookingsData, error: bookingsError } = await this.supabase
        .from('bookings')
        .select(
          `
          *,
          ride:ride_id (
            *,
            driver:driver_id (
              id,
              full_name,
              avatar_url
            )
          )
        `
        )
        .eq('user_id', params.userId!)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw new Error(`Failed to fetch user bookings: ${bookingsError.message}`);
      }

      return bookingsData || [];
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
      const { data: driverBookings, error: bookingsError } = await this.supabase
        .from('bookings')
        .select(
          `
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
        `
        )
        .eq('ride.driver_id', params.userId!)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw new Error(`Failed to fetch driver bookings: ${bookingsError.message}`);
      }

      return driverBookings || [];
    } catch (error) {
      console.error('ServerBookingService.getDriverBookings error:', error);
      throw error;
    }
  }

  /**
   * Update booking
   */
  async updateBooking(
    bookingId: string,
    params: UpdateBookingRequest
  ): Promise<Booking> {
    try {
      const { data, error } = await this.supabase
        .from('bookings')
        .update({
          ...params,
          updated_at: new Date().toISOString(),
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
      const { error } = await this.supabase.rpc('cancel_booking_and_restore_seats', {
        p_booking_id: bookingId,
      });

      if (error) {
        throw new Error(`Failed to cancel booking: ${error.message}`);
      }
    } catch (error) {
      console.error('ServerBookingService.cancelBooking error:', error);
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
        .select(
          `
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
        `
        )
        .eq('id', bookingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
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
  async getExistingBookingForRide(
    rideId: string,
    userId: string
  ): Promise<Booking | null> {
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
          return null;
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
  async calculateAdditionalPaymentAmount(
    bookingId: string,
    newSeats: number
  ): Promise<number> {
    try {
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select(
          `
          id,
          seats,
          payment_status,
          ride_id,
          ride:rides!inner(price)
        `
        )
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

      if (paymentStatus === 'completed' || paymentStatus === 'partial_refund') {
        if (newSeats <= currentSeats) {
          throw new Error('Cannot reduce seats on a paid booking');
        }
        const additionalSeats = newSeats - currentSeats;
        return additionalSeats * ridePrice;
      }

      return newSeats * ridePrice;
    } catch (error) {
      console.error('ServerBookingService.calculateAdditionalPaymentAmount error:', error);
      throw error;
    }
  }
}
