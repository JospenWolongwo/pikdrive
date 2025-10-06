import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment } from '@/types';
import { SMSService } from '@/lib/notifications/sms-service';
import { ServerOneSignalNotificationService } from './onesignal-notification-service';

/**
 * Server-side PaymentNotificationService for use in API routes
 * 
 * SINGLE RESPONSIBILITY: Payment-related notifications
 * Handles SMS and push notifications for payment events
 */
export class ServerPaymentNotificationService {
  private smsService: SMSService;
  private oneSignalService: ServerOneSignalNotificationService;

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
    
    // Use OneSignal Edge Function instead of self-managed push
    this.oneSignalService = new ServerOneSignalNotificationService(supabase);
  }

  /**
   * Send notification when payment is completed
   * Enterprise-level: Enriched with comprehensive booking details for driver
   */
  async notifyPaymentCompleted(payment: Payment): Promise<void> {
    try {
      console.log('🚀 Starting payment completion notifications for payment:', payment.id);
      // Get booking with comprehensive details
      const { data: booking } = await this.supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          ride_id,
          seats,
          verification_code,
          status,
          payment_status
        `)
        .eq('id', payment.booking_id)
        .single();

      if (!booking) {
        console.error('Booking not found for payment:', payment.id);
        return;
      }

      // Get ride details
      const { data: ride } = await this.supabase
        .from('rides')
        .select('driver_id, from_city, to_city, departure_time, price')
        .eq('id', booking.ride_id)
        .single();

      if (!ride) {
        console.error('Ride not found for booking:', booking.ride_id);
        return;
      }

      // Get passenger details for driver notification
      const { data: passenger } = await this.supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .eq('id', booking.user_id)
        .single();

      const passengerName = passenger?.full_name || passenger?.phone || 'Passager';
      const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);

      // Send SMS notification (non-blocking)
      this.sendPaymentSMS(payment, true).catch(err => 
        console.error('❌ SMS sending error:', err)
      );

      // Send push notifications via OneSignal Edge Function (non-blocking)
      console.log('📤 Sending push notifications via OneSignal...');
      const notificationPromises = Promise.all([
        // Passenger notification - Professional template
        this.oneSignalService.sendNotification({
          userId: booking.user_id,
          title: 'Payment Confirmed',
          message: `Your payment of ${formatAmount(payment.amount)} XAF has been confirmed for ${ride.from_city} to ${ride.to_city}. Verification code: ${booking.verification_code}`,
          notificationType: 'payment_success',
          data: {
            bookingId: payment.booking_id,
            paymentId: payment.id,
            rideId: ride.id,
            type: 'payment_completed',
            icon: 'CheckCircle2', // Lucide icon name
            verificationCode: booking.verification_code,
            amount: payment.amount,
            fromCity: ride.from_city,
            toCity: ride.to_city,
            departureTime: ride.departure_time,
          },
        }),
        
        // Driver notification - ENRICHED with passenger and booking details
        this.oneSignalService.sendNotification({
          userId: ride.driver_id,
          title: 'Payment Received',
          message: `${passengerName} paid ${formatAmount(payment.amount)} XAF for ${ride.from_city} to ${ride.to_city}. ${booking.seats} seat${booking.seats > 1 ? 's' : ''}. Code: ${booking.verification_code}`,
          notificationType: 'payment_success',
          data: {
            bookingId: payment.booking_id,
            paymentId: payment.id,
            rideId: ride.id,
            type: 'payment_completed_driver',
            icon: 'Wallet', // Lucide icon name
            // Enhanced driver data
            passengerId: passenger?.id,
            passengerName: passengerName,
            passengerPhone: passenger?.phone,
            passengerAvatar: passenger?.avatar_url,
            seats: booking.seats,
            verificationCode: booking.verification_code,
            amount: payment.amount,
            provider: payment.provider,
            transactionId: payment.transaction_id,
            // Ride details
            fromCity: ride.from_city,
            toCity: ride.to_city,
            departureTime: ride.departure_time,
          },
        }),
      ]).then(results => {
        console.log('✅ Payment completion notifications sent successfully:', {
          paymentId: payment.id,
          results: results.map(r => ({ success: r.success, notificationId: r.notificationId }))
        });
      }).catch(err => {
        console.error('❌ Push notification error:', err);
        throw err;
      });

      console.log('✅ Payment completion notifications initiated with enriched details');
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
