import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment } from '@/types';
import { ServerOneSignalNotificationService } from './onesignal-notification-service';

/**
 * Server-side PaymentNotificationService for use in API routes
 * 
 * SINGLE RESPONSIBILITY: Payment-related notifications via OneSignal
 * Cost-effective, rich notifications with no per-message fees
 */
export class ServerPaymentNotificationService {
  private oneSignalService: ServerOneSignalNotificationService;

  constructor(private supabase: SupabaseClient) {
    // Use OneSignal Edge Function for all notifications
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
        .select('id, driver_id, from_city, to_city, departure_time, price')
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

      console.log('🔔 [NOTIFICATIONS] Passenger details:', {
        id: passenger?.id,
        phone: passenger?.phone,
        name: passengerName
      });

      // Ensure verification code exists before sending notifications
      let verificationCode = booking.verification_code;
      
      // If no verification code exists, generate one
      if (!verificationCode) {
        console.log('⚠️ No verification code found, generating one...');
        const { data: newCode } = await this.supabase.rpc(
          'generate_booking_verification_code',
          { booking_id: payment.booking_id }
        );
        verificationCode = newCode || 'GENERATED';
        
        // Fetch the updated booking
        const { data: updatedBooking } = await this.supabase
          .from('bookings')
          .select('verification_code')
          .eq('id', payment.booking_id)
          .single();
        
        verificationCode = updatedBooking?.verification_code || verificationCode;
      }

      // Send both push notifications and SMS via OneSignal (non-blocking)
      console.log('📤 Sending notifications via OneSignal (Push + SMS)...');
      console.log('🔔 [NOTIFICATIONS] About to send passenger SMS notification');
      const notificationPromises = Promise.all([
        // Passenger notification - Push + SMS for booking confirmation with verification code
        this.oneSignalService.sendNotification({
          userId: booking.user_id,
          title: '✅ Paiement Confirmé!',
          message: `Votre paiement de ${formatAmount(payment.amount)} XAF est confirmé pour ${ride.from_city} → ${ride.to_city}. Code de vérification: ${verificationCode}`,
          notificationType: 'payment_success',
          imageUrl: '/icons/payment-success.svg',
          phoneNumber: passenger?.phone, // For SMS
          sendSMS: true, // Enable SMS for booking confirmations
          data: {
            bookingId: payment.booking_id,
            paymentId: payment.id,
            rideId: ride.id,
            type: 'payment_completed',
            icon: 'CheckCircle2',
            verificationCode: verificationCode,
            amount: payment.amount,
            fromCity: ride.from_city,
            toCity: ride.to_city,
            departureTime: ride.departure_time,
            action: 'view_booking',
            priority: 'high'
          },
        }),
        
        // Driver notification - Push only (no SMS for drivers)
        // IMPORTANT: This notification goes to the DRIVER, not the passenger
        (() => {
          console.log('🔔 [NOTIFICATIONS] About to send driver push notification');
          return this.oneSignalService.sendNotification({
          userId: ride.driver_id, // ✅ Correctly targets the driver
          title: '💰 Nouvelle Réservation Payée!',
          message: `${passengerName} a payé ${formatAmount(payment.amount)} XAF pour ${ride.from_city} → ${ride.to_city}. ${booking.seats} place${booking.seats > 1 ? 's' : ''}. Code de vérification: ${verificationCode}`,
          notificationType: 'payment_success',
          imageUrl: '/icons/payment-received.svg',
          sendSMS: false, // No SMS for drivers - push only
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
            verificationCode: verificationCode,
            amount: payment.amount,
            provider: payment.provider,
            transactionId: payment.transaction_id,
            // Ride details
            fromCity: ride.from_city,
            toCity: ride.to_city,
            departureTime: ride.departure_time,
          },
        });
        })(),
      ]).then(results => {
        console.log('✅ [NOTIFICATIONS] Payment completion notifications sent:', {
          paymentId: payment.id,
          passengerNotification: results[0],
          driverNotification: results[1],
          results: results.map((r, index) => ({ 
            index,
            success: r.success, 
            notificationId: r.notificationId,
            error: r.error 
          }))
        });
      }).catch(err => {
        console.error('❌ [NOTIFICATIONS] Push notification error:', err);
        console.error('❌ [NOTIFICATIONS] Error stack:', err.stack);
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
      // Get booking details for notification
      const { data: booking } = await this.supabase
        .from('bookings')
        .select('user_id, ride_id')
        .eq('id', payment.booking_id)
        .single();

      if (!booking) return;

      // Get ride details
      const { data: ride } = await this.supabase
        .from('rides')
        .select('id, driver_id, from_city, to_city')
        .eq('id', booking.ride_id)
        .single();

      if (!ride) return;

      const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);

      // Send failure notification to passenger
      await this.oneSignalService.sendNotification({
        userId: booking.user_id,
        title: '❌ Paiement Échoué',
        message: `Votre paiement de ${formatAmount(payment.amount)} XAF pour ${ride.from_city} → ${ride.to_city} a échoué. ${reason || 'Veuillez réessayer.'}`,
        notificationType: 'payment_failed',
        imageUrl: '/icons/payment-failed.svg',
        data: {
          bookingId: payment.booking_id,
          paymentId: payment.id,
          rideId: ride.id,
          type: 'payment_failed',
          icon: 'XCircle',
          amount: payment.amount,
          fromCity: ride.from_city,
          toCity: ride.to_city,
          reason: reason,
          action: 'retry_payment',
          priority: 'high'
        },
      });

      console.log('✅ Payment failure notification sent via OneSignal');
    } catch (error) {
      console.error('ServerPaymentNotificationService.notifyPaymentFailed error:', error);
      // Don't throw - notifications are non-critical
    }
  }

  // SMS functionality removed - using OneSignal only for cost efficiency

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
