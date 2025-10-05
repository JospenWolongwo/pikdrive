import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment } from '@/types';
import { SMSService } from '@/lib/notifications/sms-service';

/**
 * Server-side PaymentNotificationService for use in API routes
 * 
 * SINGLE RESPONSIBILITY: Payment-related notifications
 * Handles SMS, push notifications, and email for payment events
 */
export class ServerPaymentNotificationService {
  private smsService: SMSService;

  constructor(private supabase: SupabaseClient) {
    this.smsService = new SMSService({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      fromNumber: process.env.TWILIO_FROM_NUMBER!,
      environment:
        process.env.TWILIO_ENVIRONMENT === "production"
          ? "production"
          : process.env.NODE_ENV === "production"
          ? "production"
          : "sandbox",
    });
  }

  /**
   * Send notification when payment is completed
   */
  async notifyPaymentCompleted(payment: Payment): Promise<void> {
    try {
      // Get booking and ride details
      const { data: booking } = await this.supabase
        .from('bookings')
        .select('user_id, ride_id')
        .eq('id', payment.booking_id)
        .single();

      if (!booking) {
        console.error('Booking not found for payment:', payment.id);
        return;
      }

      const { data: ride } = await this.supabase
        .from('rides')
        .select('driver_id, from_city, to_city')
        .eq('id', booking.ride_id)
        .single();

      if (!ride) {
        console.error('Ride not found for booking:', booking.ride_id);
        return;
      }

      // Send SMS notification (non-blocking)
      this.sendPaymentSMS(payment, true).catch(err => 
        console.error('❌ SMS sending error:', err)
      );

      // Send push notifications (non-blocking)
      Promise.all([
        this.sendPassengerNotification(booking.user_id, ride, payment),
        this.sendDriverNotification(ride.driver_id, ride, payment),
      ]).catch(err => 
        console.warn('⚠️ Push notification error:', err)
      );

      console.log('✅ Payment completion notifications initiated');
    } catch (error) {
      console.error('ServerPaymentNotificationService.notifyPaymentCompleted error:', error);
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Send notification when payment fails
   */
  async notifyPaymentFailed(payment: Payment, reason?: string): Promise<void> {
    try {
      // Send SMS notification (non-blocking)
      this.sendPaymentSMS(payment, false, reason).catch(err => 
        console.error('❌ SMS sending error:', err)
      );

      console.log('✅ Payment failure notifications initiated');
    } catch (error) {
      console.error('ServerPaymentNotificationService.notifyPaymentFailed error:', error);
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Send SMS notification for payment
   */
  private async sendPaymentSMS(
    payment: Payment, 
    success: boolean, 
    reason?: string
  ): Promise<void> {
    try {
      // Get phone number from payment or booking
      const { data: booking } = await this.supabase
        .from('bookings')
        .select('user_id')
        .eq('id', payment.booking_id)
        .single();

      if (!booking) return;

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('phone')
        .eq('id', booking.user_id)
        .single();

      if (!profile?.phone) return;

      const message = success
        ? `✅ Paiement confirmé! Montant: ${payment.amount} XAF. Transaction: ${payment.transaction_id}. Votre réservation est confirmée.`
        : `❌ Paiement échoué. Montant: ${payment.amount} XAF. ${reason || 'Veuillez réessayer.'}`;

      await this.smsService.sendMessage({
        to: profile.phone,
        message,
      });

      console.log('✅ Payment SMS sent');
    } catch (error) {
      console.error('Error sending payment SMS:', error);
      throw error;
    }
  }

  /**
   * Send push notification to passenger
   */
  private async sendPassengerNotification(
    userId: string, 
    ride: any, 
    payment: Payment
  ): Promise<void> {
    try {
      // Note: In production, use a proper push notification service
      // For now, we'll use the notification API endpoint
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      await fetch(`${baseUrl}/api/notifications/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationData: JSON.stringify({
            type: 'payment_completed',
            userId,
            title: '🎉 Paiement Confirmé !',
            body: `Votre réservation pour ${ride.from_city} → ${ride.to_city} est confirmée. Le chauffeur va bientôt vérifier votre code.`,
            data: {
              bookingId: payment.booking_id,
              paymentId: payment.id,
              type: 'payment_completed',
            },
          }),
        }),
      });
    } catch (error) {
      console.error('Error sending passenger notification:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Send push notification to driver
   */
  private async sendDriverNotification(
    driverId: string, 
    ride: any, 
    payment: Payment
  ): Promise<void> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      await fetch(`${baseUrl}/api/notifications/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationData: JSON.stringify({
            type: 'payment_completed_driver',
            userId: driverId,
            title: '💳 Paiement Reçu !',
            body: `Un passager a complété le paiement pour ${ride.from_city} → ${ride.to_city}. Vérifiez le code de réservation.`,
            data: {
              bookingId: payment.booking_id,
              paymentId: payment.id,
              type: 'payment_completed_driver',
            },
          }),
        }),
      });
    } catch (error) {
      console.error('Error sending driver notification:', error);
      // Non-critical, don't throw
    }
  }
}
