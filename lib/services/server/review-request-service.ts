import type { SupabaseClient } from '@supabase/supabase-js';
import { ServerMultiChannelNotificationService } from './multi-channel-notification-service';

/**
 * Server-side Review Request Service
 * 
 * SINGLE RESPONSIBILITY: Send review request notifications
 * Automatically requests reviews 6-7 hours after ride completion
 * Uses multi-channel approach: WhatsApp + Push notifications
 */
export class ServerReviewRequestService {
  private multiChannelService: ServerMultiChannelNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.multiChannelService = new ServerMultiChannelNotificationService(supabase);
  }

  /**
   * Send review requests for eligible bookings
   * Called by cron job every hour
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
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const sevenHoursAgo = new Date(now.getTime() - 7 * 60 * 60 * 1000);

      // Find eligible bookings:
      // 1. Paid and verified
      // 2. Departure time was 6-7 hours ago OR ride status is 'completed'
      // 3. Review not yet requested
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
            departure_time,
            status
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

          // Check if review request already sent
          const metadata = booking.metadata as any || {};
          if (metadata.review_requested_at) {
            continue;
          }

          // Check timing: 6-7 hours after departure OR ride completed
          const departureTime = new Date(ride.departure_time);
          const hoursSinceDeparture = (now.getTime() - departureTime.getTime()) / (1000 * 60 * 60);

          const isTimeEligible = hoursSinceDeparture >= 6 && hoursSinceDeparture <= 24;
          const isRideCompleted = ride.status === 'completed';

          if (!isTimeEligible && !isRideCompleted) {
            continue;
          }

          // Fetch driver details
          const { data: driver } = await this.supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('id', ride.driver_id)
            .single();

          if (!driver) {
            continue;
          }

          const route = `${ride.from_city} → ${ride.to_city}`;
          const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reviews/submit?booking_id=${booking.id}`;

          // Send review request to passenger (WhatsApp + Push Notification)
          try {
            const passengerResult = await this.multiChannelService.sendReviewRequest({
              userId: passenger.id,
              phoneNumber: passenger.phone,
              userName: passenger.full_name || 'Passager',
              otherPartyName: driver.full_name || 'Conducteur',
              route,
              reviewUrl,
              bookingId: booking.id,
              isDriver: false, // This is for passenger
            });

            if (passengerResult.onesignal || passengerResult.whatsapp) {
              passengerRequestsSent++;
              console.log(`[REVIEW-REQUEST] Sent passenger review request for booking ${booking.id}`, {
                onesignal: passengerResult.onesignal,
                whatsapp: passengerResult.whatsapp,
              });
            }
          } catch (err) {
            console.error(`[REVIEW-REQUEST] Error sending passenger request for booking ${booking.id}:`, err);
            errors++;
          }

          // Send review request to driver (WhatsApp + Push Notification)
          try {
            const driverResult = await this.multiChannelService.sendReviewRequest({
              userId: driver.id,
              phoneNumber: driver.phone,
              userName: driver.full_name || 'Conducteur',
              otherPartyName: passenger.full_name || 'Passager',
              route,
              reviewUrl,
              bookingId: booking.id,
              isDriver: true, // This is for driver
            });

            if (driverResult.onesignal || driverResult.whatsapp) {
              driverRequestsSent++;
              console.log(`[REVIEW-REQUEST] Sent driver review request for booking ${booking.id}`, {
                onesignal: driverResult.onesignal,
                whatsapp: driverResult.whatsapp,
              });
            }
          } catch (err) {
            console.error(`[REVIEW-REQUEST] Error sending driver request for booking ${booking.id}:`, err);
            errors++;
          }

          // Update booking metadata to mark review as requested
          await this.supabase
            .from('bookings')
            .update({
              metadata: {
                ...metadata,
                review_requested_at: now.toISOString(),
              },
            })
            .eq('id', booking.id);

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
