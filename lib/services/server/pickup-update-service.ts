import type { SupabaseClient } from '@supabase/supabase-js';
import { ServerMultiChannelNotificationService } from './multi-channel-notification-service';

/**
 * Server-side Pickup Update Service
 * 
 * SINGLE RESPONSIBILITY: Send real-time pickup point updates to passengers
 * Notifies when driver is near pickup point (10-15 minutes away)
 */
export class ServerPickupUpdateService {
  private multiChannelService: ServerMultiChannelNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.multiChannelService = new ServerMultiChannelNotificationService(supabase);
  }

  /**
   * Send pickup point update notification
   * Called when driver updates location and is near pickup point
   */
  async sendPickupUpdate(data: {
    readonly bookingId: string;
    readonly driverId: string;
    readonly currentPickupPoint: string;
    readonly estimatedArrival: string; // e.g., "10 minutes", "5 minutes"
  }): Promise<{ onesignal: boolean; whatsapp: boolean }> {
    try {
      // Fetch booking with passenger and ride details
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          ride:ride_id (
            id,
            from_city,
            to_city
          ),
          user:user_id (
            id,
            full_name,
            phone
          ),
          ride:ride_id (
            driver:driver_id (
              id,
              full_name
            )
          )
        `)
        .eq('id', data.bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('[PICKUP-UPDATE] Booking not found:', data.bookingId);
        return { onesignal: false, whatsapp: false };
      }

      const ride = booking.ride as any;
      const user = booking.user as any;
      const driver = ride?.driver as any;

      if (!ride || !user) {
        console.error('[PICKUP-UPDATE] Missing ride or user data');
        return { onesignal: false, whatsapp: false };
      }

      const route = `${ride.from_city} → ${ride.to_city}`;
      const driverName = driver?.full_name || 'Le conducteur';

      console.log('[PICKUP-UPDATE] Sending pickup update:', {
        bookingId: data.bookingId,
        passengerId: user.id,
        currentPoint: data.currentPickupPoint,
        estimatedArrival: data.estimatedArrival,
      });

      // Send multi-channel notification
      const result = await this.multiChannelService.sendPickupPointUpdate({
        passengerId: user.id,
        phoneNumber: user.phone,
        passengerName: user.full_name || 'Passager',
        driverName: driverName,
        currentPickupPoint: data.currentPickupPoint,
        estimatedArrival: data.estimatedArrival,
        route: route,
        bookingId: booking.id,
      });

      return result;
    } catch (error) {
      console.error('[PICKUP-UPDATE] Error sending pickup update:', error);
      return { onesignal: false, whatsapp: false };
    }
  }

  /**
   * Check if driver is near pickup point and send update if needed
   * This would be called from a location tracking service
   */
  async checkAndSendPickupUpdate(
    bookingId: string,
    driverLatitude: number,
    driverLongitude: number
  ): Promise<boolean> {
    try {
      // Fetch booking with pickup point details
      const { data: booking, error } = await this.supabase
        .from('bookings')
        .select(`
          id,
          pickup_point_name,
          pickup_time,
          selected_pickup_point_id,
          ride:ride_id (
            id,
            pickup_points
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error || !booking) {
        return false;
      }

      const ride = booking.ride as any;
      const pickupPoints = ride?.pickup_points;

      if (!pickupPoints || !Array.isArray(pickupPoints)) {
        return false;
      }

      // Find the selected pickup point
      const selectedPoint = pickupPoints.find(
        (point: any) => point.id === booking.selected_pickup_point_id
      );

      if (!selectedPoint) {
        return false;
      }

      // TODO: Calculate distance between driver and pickup point
      // For now, this is a placeholder - would need geocoding service
      // to convert pickup point name to coordinates, then calculate distance

      // If driver is within 10-15 minutes (estimated), send update
      const pickupTime = new Date(booking.pickup_time);
      const now = new Date();
      const minutesUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60);

      if (minutesUntilPickup >= 5 && minutesUntilPickup <= 15) {
        const estimatedArrival = `${Math.round(minutesUntilPickup)} minutes`;
        await this.sendPickupUpdate({
          bookingId: booking.id,
          driverId: '', // Would be fetched from ride
          currentPickupPoint: booking.pickup_point_name || selectedPoint.name,
          estimatedArrival: estimatedArrival,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('[PICKUP-UPDATE] Error checking pickup update:', error);
      return false;
    }
  }
}
