import type { SupabaseClient } from '@supabase/supabase-js';
import { ServerMultiChannelNotificationService } from './multi-channel-notification-service';

/**
 * Server-side Ride Reminder Service
 * 
 * SINGLE RESPONSIBILITY: Send ride reminders via scheduled jobs
 * Sends reminders 24 hours before and 2 hours before departure
 */
export class ServerRideReminderService {
  private multiChannelService: ServerMultiChannelNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.multiChannelService = new ServerMultiChannelNotificationService(supabase);
  }

  /**
   * Send day-before reminders (24 hours before departure)
   */
  async sendDayBeforeReminders(): Promise<number> {
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(tomorrow.getHours() + 24);

      // Find bookings with departure_time in next 24-25 hours
      const { data: bookings, error } = await this.supabase
        .from('bookings')
        .select(`
          id,
          seats,
          pickup_point_name,
          pickup_time,
          user_id,
          ride:ride_id (
            id,
            from_city,
            to_city,
            departure_time
          ),
          user:user_id (
            id,
            full_name,
            phone
          )
        `)
        .eq('status', 'confirmed')
        .in('payment_status', ['completed', 'partial_refund'])
        .gte('ride.departure_time', tomorrow.toISOString())
        .lt('ride.departure_time', new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('[RIDE-REMINDER] Error fetching bookings:', error);
        return 0;
      }

      if (!bookings || bookings.length === 0) {
        console.log('[RIDE-REMINDER] No bookings found for day-before reminders');
        return 0;
      }

      console.log(`[RIDE-REMINDER] Sending ${bookings.length} day-before reminders`);

      let successCount = 0;
      for (const booking of bookings) {
        try {
          const ride = booking.ride as any;
          const user = booking.user as any;

          if (!ride || !user) {
            continue;
          }

          const result = await this.multiChannelService.sendRideReminder({
            userId: user.id,
            phoneNumber: user.phone,
            userName: user.full_name || 'Passager',
            route: `${ride.from_city} → ${ride.to_city}`,
            departureTime: ride.departure_time,
            pickupPointName: booking.pickup_point_name,
            pickupTime: booking.pickup_time,
            bookingId: booking.id,
          });

          if (result.onesignal || result.whatsapp) {
            successCount++;
          }
        } catch (err) {
          console.error(`[RIDE-REMINDER] Error sending reminder for booking ${booking.id}:`, err);
        }
      }

      console.log(`[RIDE-REMINDER] Sent ${successCount}/${bookings.length} day-before reminders`);
      return successCount;
    } catch (error) {
      console.error('[RIDE-REMINDER] Error in sendDayBeforeReminders:', error);
      return 0;
    }
  }

  /**
   * Send morning-of reminders (2 hours before departure)
   */
  async sendMorningOfReminders(): Promise<number> {
    try {
      const now = new Date();
      const twoHoursLater = new Date(now);
      twoHoursLater.setHours(twoHoursLater.getHours() + 2);

      // Find bookings with departure_time in next 2-3 hours
      const { data: bookings, error } = await this.supabase
        .from('bookings')
        .select(`
          id,
          seats,
          pickup_point_name,
          pickup_time,
          user_id,
          ride:ride_id (
            id,
            from_city,
            to_city,
            departure_time
          ),
          user:user_id (
            id,
            full_name,
            phone
          )
        `)
        .eq('status', 'confirmed')
        .in('payment_status', ['completed', 'partial_refund'])
        .gte('ride.departure_time', twoHoursLater.toISOString())
        .lt('ride.departure_time', new Date(twoHoursLater.getTime() + 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('[RIDE-REMINDER] Error fetching bookings:', error);
        return 0;
      }

      if (!bookings || bookings.length === 0) {
        console.log('[RIDE-REMINDER] No bookings found for morning-of reminders');
        return 0;
      }

      console.log(`[RIDE-REMINDER] Sending ${bookings.length} morning-of reminders`);

      let successCount = 0;
      for (const booking of bookings) {
        try {
          const ride = booking.ride as any;
          const user = booking.user as any;

          if (!ride || !user) {
            continue;
          }

          const result = await this.multiChannelService.sendRideReminder({
            userId: user.id,
            phoneNumber: user.phone,
            userName: user.full_name || 'Passager',
            route: `${ride.from_city} → ${ride.to_city}`,
            departureTime: ride.departure_time,
            pickupPointName: booking.pickup_point_name,
            pickupTime: booking.pickup_time,
            bookingId: booking.id,
          });

          if (result.onesignal || result.whatsapp) {
            successCount++;
          }
        } catch (err) {
          console.error(`[RIDE-REMINDER] Error sending reminder for booking ${booking.id}:`, err);
        }
      }

      console.log(`[RIDE-REMINDER] Sent ${successCount}/${bookings.length} morning-of reminders`);
      return successCount;
    } catch (error) {
      console.error('[RIDE-REMINDER] Error in sendMorningOfReminders:', error);
      return 0;
    }
  }

  /**
   * Send all pending reminders (called by scheduled job)
   */
  async sendAllReminders(): Promise<{ dayBefore: number; morningOf: number }> {
    const [dayBefore, morningOf] = await Promise.all([
      this.sendDayBeforeReminders(),
      this.sendMorningOfReminders(),
    ]);

    return { dayBefore, morningOf };
  }
}
