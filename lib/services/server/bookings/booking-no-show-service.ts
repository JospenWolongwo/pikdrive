import type { SupabaseClient } from '@supabase/supabase-js';
import { BookingApiError } from './booking-errors';
import { ServerBookingPolicyService } from './booking-policy-service';
import { ServerOneSignalNotificationService } from '../onesignal-notification-service';

type NoShowResult = {
  status: 'completed';
  noShowMarkedAt: string;
};

export class ServerBookingNoShowService {
  private readonly policyService = new ServerBookingPolicyService();
  private readonly notificationService: ServerOneSignalNotificationService;

  constructor(
    private supabase: SupabaseClient,
    private serviceSupabase?: SupabaseClient
  ) {
    this.notificationService = new ServerOneSignalNotificationService(
      serviceSupabase ?? supabase
    );
  }

  async markPassengerNoShow(params: {
    bookingId: string;
    driverId: string;
    contactAttempted: boolean;
    note?: string;
  }): Promise<NoShowResult> {
    const { bookingId, driverId, contactAttempted, note } = params;
    const db = this.serviceSupabase ?? this.supabase;

    if (!this.policyService.isEnabled()) {
      throw new BookingApiError(
        'No-show recording is not available right now.',
        403,
        'NO_SHOW_NOT_ALLOWED'
      );
    }

    if (!contactAttempted) {
      throw new BookingApiError(
        'Please confirm that you attempted to contact the passenger before recording a no-show.',
        400,
        'NO_SHOW_NOT_ALLOWED'
      );
    }

    const { data: booking, error } = await db
      .from('bookings')
      .select(
        `
        id,
        user_id,
        ride_id,
        status,
        payment_status,
        code_verified,
        pickup_time,
        no_show_marked_at,
        ride:ride_id (
          id,
          driver_id,
          from_city,
          to_city,
          departure_time
        )
      `
      )
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new BookingApiError('Booking not found', 404);
    }

    const rideRelation = booking.ride as
      | {
          id: string;
          driver_id: string;
          from_city: string;
          to_city: string;
          departure_time: string;
        }
      | {
          id: string;
          driver_id: string;
          from_city: string;
          to_city: string;
          departure_time: string;
        }[]
      | null;
    const ride = Array.isArray(rideRelation) ? rideRelation[0] ?? null : rideRelation;

    if (!ride || ride.driver_id !== driverId) {
      throw new BookingApiError(
        'Only the driver for this ride can record a no-show.',
        403,
        'NO_SHOW_NOT_ALLOWED'
      );
    }

    if (booking.no_show_marked_at) {
      throw new BookingApiError(
        'This booking was already recorded as a no-show.',
        409,
        'NO_SHOW_ALREADY_RECORDED'
      );
    }

    if (booking.code_verified === true) {
      throw new BookingApiError(
        'This booking has already been verified and can no longer be marked as no-show.',
        403,
        'NO_SHOW_NOT_ALLOWED'
      );
    }

    const paidStatuses = new Set(['completed', 'partial', 'partial_refund']);
    if (!paidStatuses.has(booking.payment_status ?? '')) {
      throw new BookingApiError(
        'Only paid bookings can be recorded as no-show.',
        400,
        'NO_SHOW_NOT_ALLOWED'
      );
    }

    const policy = this.policyService.evaluatePolicy({
      status: booking.status,
      payment_status: booking.payment_status,
      code_verified: booking.code_verified,
      pickup_time: booking.pickup_time,
      departure_time: ride.departure_time,
      no_show_marked_at: booking.no_show_marked_at,
    });

    if (!policy) {
      throw new BookingApiError(
        'Booking policy data is unavailable for this booking.',
        400,
        'NO_SHOW_NOT_ALLOWED'
      );
    }

    if (policy.blockReason === 'already_no_show') {
      throw new BookingApiError(
        'This booking was already recorded as a no-show.',
        409,
        'NO_SHOW_ALREADY_RECORDED'
      );
    }

    if (!policy.canDriverMarkNoShow) {
      if (!policy.isLateWindow || Date.now() < new Date(policy.noShowEligibleAt).getTime()) {
        throw new BookingApiError(
          'No-show can only be recorded 15 minutes after the passenger travel start time.',
          403,
          'NO_SHOW_TOO_EARLY'
        );
      }

      throw new BookingApiError(
        'This booking cannot be recorded as a no-show right now.',
        403,
        'NO_SHOW_NOT_ALLOWED'
      );
    }

    const noShowMarkedAt = new Date().toISOString();
    const trimmedNote = note?.trim() ? note.trim() : null;

    console.info('[BOOKING POLICY] Recording passenger no-show', {
      bookingId,
      driverId,
      rideId: ride.id,
      travelStartAt: policy.travelStartAt,
      noShowEligibleAt: policy.noShowEligibleAt,
    });

    const { data: updatedBooking, error: updateError } = await db
      .from('bookings')
      .update({
        status: 'completed',
        no_show_marked_at: noShowMarkedAt,
        no_show_marked_by: driverId,
        no_show_contact_attempted: true,
        no_show_note: trimmedNote,
        updated_at: noShowMarkedAt,
      })
      .eq('id', bookingId)
      .select('status, no_show_marked_at')
      .single();

    if (updateError || !updatedBooking) {
      throw new BookingApiError(
        `Failed to record no-show: ${updateError?.message || 'Unknown error'}`,
        500
      );
    }

    this.notificationService
      .sendNotification({
        userId: booking.user_id,
        title: 'Booking update',
        message:
          'Your booking was marked as not taken at pickup time. If this is incorrect, contact support.',
        notificationType: 'booking_updated',
        data: {
          bookingId,
          rideId: ride.id,
          type: 'booking_updated',
          icon: 'Info',
          action: 'view_bookings',
          deepLink: `/bookings/${bookingId}`,
          noShow: true,
        },
      })
      .catch((notificationError) => {
        console.error('[BOOKING POLICY] No-show notification failed', {
          bookingId,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      });

    return {
      status: updatedBooking.status as 'completed',
      noShowMarkedAt: updatedBooking.no_show_marked_at,
    };
  }
}
