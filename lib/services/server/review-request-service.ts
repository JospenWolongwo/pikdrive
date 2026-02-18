import type { SupabaseClient } from '@supabase/supabase-js';
import { ServerMultiChannelNotificationService } from './multi-channel-notification-service';

/**
 * Server-side Review Request Service
 *
 * SINGLE RESPONSIBILITY: Send review request notifications
 * Automatically requests reviews after a short post-ride delay
 * Uses multi-channel approach: WhatsApp + Push notifications
 */
export class ServerReviewRequestService {
  private multiChannelService: ServerMultiChannelNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.multiChannelService = new ServerMultiChannelNotificationService(supabase);
  }

  /**
   * Send review requests for eligible bookings
   * Called by cron job daily (Vercel Hobby plan constraint)
   */
  async sendReviewRequests(): Promise<{
    success: boolean;
    passengerRequestsSent: number;
    driverRequestsSent: number;
    errors: number;
  }> {
    try {
      console.log('[REVIEW-REQUEST] Starting review request job...');

      const now = new Date();
      const minHoursAfterDeparture = 6;
      // With once-daily cron, max must be >= min + 24 to avoid missing trips.
      const maxHoursAfterDeparture = 30;

      // Find eligible bookings:
      // 1. Paid and verified
      // 2. Departure time in [6h, 30h] to balance timeliness and daily coverage
      // 3. Review not yet requested (per recipient)
      const { data: bookings, error: fetchError } = await this.supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          ride_id,
          metadata,
          ride:ride_id (
            id,
            driver_id,
            from_city,
            to_city,
            departure_time
          ),
          passenger:user_id (
            id,
            full_name,
            phone
          )
        `)
        .in('payment_status', ['completed', 'partial_refund'])
        .eq('code_verified', true)
        .eq('status', 'confirmed');

      if (fetchError) {
        console.error('[REVIEW-REQUEST] Error fetching bookings:', fetchError);
        return { success: false, passengerRequestsSent: 0, driverRequestsSent: 0, errors: 1 };
      }

      if (!bookings || bookings.length === 0) {
        console.log('[REVIEW-REQUEST] No eligible bookings found');
        return { success: true, passengerRequestsSent: 0, driverRequestsSent: 0, errors: 0 };
      }

      console.log(`[REVIEW-REQUEST] Found ${bookings.length} eligible bookings`);

      let passengerRequestsSent = 0;
      let driverRequestsSent = 0;
      let errors = 0;

      for (const booking of bookings) {
        try {
          const ride = booking.ride as any;
          const passenger = booking.passenger as any;

          if (!ride || !passenger) {
            continue;
          }

          const metadata = (booking.metadata as Record<string, any>) || {};
          const passengerAlreadyRequestedAt =
            metadata.review_request_passenger_sent_at || metadata.review_requested_at;
          const driverAlreadyRequestedAt =
            metadata.review_request_driver_sent_at || metadata.review_requested_at;

          if (passengerAlreadyRequestedAt && driverAlreadyRequestedAt) {
            continue;
          }

          const departureTime = new Date(ride.departure_time);
          const hoursSinceDeparture = (now.getTime() - departureTime.getTime()) / (1000 * 60 * 60);
          const isTimeEligible =
            hoursSinceDeparture >= minHoursAfterDeparture &&
            hoursSinceDeparture <= maxHoursAfterDeparture;

          if (!isTimeEligible) {
            continue;
          }

          const { data: driver, error: driverError } = await this.supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('id', ride.driver_id)
            .maybeSingle();

          if (driverError || !driver) {
            if (driverError) {
              console.error(`[REVIEW-REQUEST] Error fetching driver for booking ${booking.id}:`, driverError);
              errors++;
            }
            continue;
          }

          const route = `${ride.from_city} -> ${ride.to_city}`;
          const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reviews/submit?booking_id=${booking.id}`;

          let passengerSent = Boolean(passengerAlreadyRequestedAt);
          let driverSent = Boolean(driverAlreadyRequestedAt);
          let metadataChanged = false;
          const nextMetadata: Record<string, any> = { ...metadata };

          if (!passengerAlreadyRequestedAt) {
            try {
              const passengerResult = await this.multiChannelService.sendReviewRequest({
                userId: passenger.id,
                phoneNumber: passenger.phone,
                userName: passenger.full_name || 'Passager',
                otherPartyName: driver.full_name || 'Conducteur',
                route,
                reviewUrl,
                bookingId: booking.id,
                isDriver: false,
              });

              if (passengerResult.onesignal || passengerResult.whatsapp) {
                passengerSent = true;
                passengerRequestsSent++;
                nextMetadata.review_request_passenger_sent_at = now.toISOString();
                metadataChanged = true;
                console.log(`[REVIEW-REQUEST] Sent passenger review request for booking ${booking.id}`, {
                  onesignal: passengerResult.onesignal,
                  whatsapp: passengerResult.whatsapp,
                });
              } else {
                errors++;
                console.warn(`[REVIEW-REQUEST] Passenger request not delivered for booking ${booking.id}`);
              }
            } catch (err) {
              console.error(`[REVIEW-REQUEST] Error sending passenger request for booking ${booking.id}:`, err);
              errors++;
            }
          }

          if (!driverAlreadyRequestedAt) {
            try {
              const driverResult = await this.multiChannelService.sendReviewRequest({
                userId: driver.id,
                phoneNumber: driver.phone,
                userName: driver.full_name || 'Conducteur',
                otherPartyName: passenger.full_name || 'Passager',
                route,
                reviewUrl,
                bookingId: booking.id,
                isDriver: true,
              });

              if (driverResult.onesignal || driverResult.whatsapp) {
                driverSent = true;
                driverRequestsSent++;
                nextMetadata.review_request_driver_sent_at = now.toISOString();
                metadataChanged = true;
                console.log(`[REVIEW-REQUEST] Sent driver review request for booking ${booking.id}`, {
                  onesignal: driverResult.onesignal,
                  whatsapp: driverResult.whatsapp,
                });
              } else {
                errors++;
                console.warn(`[REVIEW-REQUEST] Driver request not delivered for booking ${booking.id}`);
              }
            } catch (err) {
              console.error(`[REVIEW-REQUEST] Error sending driver request for booking ${booking.id}:`, err);
              errors++;
            }
          }

          if (passengerSent && driverSent && !metadata.review_requested_at) {
            nextMetadata.review_requested_at = now.toISOString();
            metadataChanged = true;
          }

          if (metadataChanged) {
            const { error: updateError } = await this.supabase
              .from('bookings')
              .update({
                metadata: nextMetadata,
              })
              .eq('id', booking.id);

            if (updateError) {
              console.error(`[REVIEW-REQUEST] Error updating metadata for booking ${booking.id}:`, updateError);
              errors++;
            }
          }
        } catch (err) {
          console.error(`[REVIEW-REQUEST] Error processing booking ${booking.id}:`, err);
          errors++;
        }
      }

      console.log('[REVIEW-REQUEST] Review request job completed:', {
        passengerRequestsSent,
        driverRequestsSent,
        errors,
      });

      return {
        success: true,
        passengerRequestsSent,
        driverRequestsSent,
        errors,
      };
    } catch (error) {
      console.error('[REVIEW-REQUEST] Error in sendReviewRequests:', error);
      return {
        success: false,
        passengerRequestsSent: 0,
        driverRequestsSent: 0,
        errors: 1,
      };
    }
  }
}

