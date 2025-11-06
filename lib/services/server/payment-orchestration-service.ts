import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment, PaymentTransactionStatus } from '@/types';
import { ServerPaymentService } from './payment-service';
import { ServerBookingService } from './booking-service';
import { ServerReceiptService } from './receipt-service';
import { ServerPaymentNotificationService } from './payment-notification-service';
import { ServerOneSignalNotificationService } from './onesignal-notification-service';

/**
 * Server-side PaymentOrchestrationService
 * 
 * SINGLE RESPONSIBILITY: Coordinate payment-related workflows
 * Orchestrates between multiple services but doesn't implement business logic itself
 */
export class ServerPaymentOrchestrationService {
  private paymentService: ServerPaymentService;
  private bookingService: ServerBookingService;
  private receiptService: ServerReceiptService;
  private notificationService: ServerPaymentNotificationService;
  private oneSignalService: ServerOneSignalNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.paymentService = new ServerPaymentService(supabase);
    this.bookingService = new ServerBookingService(supabase);
    this.receiptService = new ServerReceiptService(supabase);
    this.notificationService = new ServerPaymentNotificationService(supabase);
    this.oneSignalService = new ServerOneSignalNotificationService(supabase);
  }

  /**
   * Handle payment status change and coordinate all related actions
   */
  async handlePaymentStatusChange(
    payment: Payment,
    newStatus: PaymentTransactionStatus,
    metadata?: {
      transaction_id?: string;
      provider_response?: any;
      error_message?: string;
    }
  ): Promise<void> {
    try {
      console.log('🔄 Orchestrating payment status change:', {
        payment_id: payment.id,
        booking_id: payment.booking_id,
        old_status: payment.status,
        new_status: newStatus,
      });

      // Validate state transition
      if (!this.paymentService.validateStateTransition(payment.status, newStatus)) {
        throw new Error(
          `Invalid payment state transition: ${payment.status} → ${newStatus}`
        );
      }

      // Update payment status
      const updatedPayment = await this.paymentService.updatePaymentStatus(
        payment.id,
        newStatus,
        metadata
      );

      // Handle completed payment
      if (newStatus === 'completed') {
        await this.handleCompletedPayment(updatedPayment);
      }

      // Handle failed payment
      if (newStatus === 'failed') {
        await this.handleFailedPayment(updatedPayment, metadata?.error_message);
      }

      console.log('✅ Payment status change orchestrated successfully');
    } catch (error) {
      console.error('ServerPaymentOrchestrationService.handlePaymentStatusChange error:', error);
      throw error;
    }
  }

  /**
   * Handle completed payment workflow
   */
  private async handleCompletedPayment(payment: Payment): Promise<void> {
    try {
      // Update booking status first
      await this.bookingService.updateBooking(payment.booking_id, {
        payment_status: 'completed',
        status: 'pending_verification',
      });

      // Get booking with explicit columns (avoids PostgREST relationship cache issues)
      let { data: bookingData, error: bookingError } = await this.supabase
        .from('bookings')
        .select('id, ride_id, user_id, seats, status, verification_code, created_at')
        .eq('id', payment.booking_id)
        .single();

      if (bookingError || !bookingData) {
        console.error('❌ [ORCHESTRATION] Booking query failed:', {
          error: bookingError,
          code: bookingError?.code,
          message: bookingError?.message,
          paymentId: payment.id,
          bookingId: payment.booking_id
        });
        
        // Try fallback: Fetch booking without relations and manually fetch related data
        const { data: simpleBooking, error: simpleError } = await this.supabase
          .from('bookings')
          .select('id, ride_id, user_id, seats, status, verification_code, created_at')
          .eq('id', payment.booking_id)
          .single();
          
        if (!simpleBooking) {
          console.error('❌ [ORCHESTRATION] Booking not found in fallback:', {
            paymentId: payment.id,
            bookingId: payment.booking_id,
            error: simpleError
          });
          return;
        }
        
        // Use fallback booking data
        bookingData = simpleBooking;
      }

      // Fetch related data in parallel (more efficient than nested queries)
      const [rideResult, userResult] = await Promise.all([
        this.supabase
          .from('rides')
          .select('id, from_city, to_city, departure_time, driver_id')
          .eq('id', bookingData.ride_id)
          .single(),
        this.supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('id', bookingData.user_id)
          .single()
      ]);

      const { data: rideData, error: rideError } = rideResult;
      const { data: userData, error: userError } = userResult;

      if (rideError || !rideData) {
        console.error('❌ [ORCHESTRATION] Ride not found:', {
          rideId: bookingData.ride_id,
          error: rideError
        });
        return;
      }

      if (userError || !userData) {
        console.error('❌ [ORCHESTRATION] User not found:', {
          userId: bookingData.user_id,
          error: userError
        });
        return;
      }

      // Fetch driver data
      const { data: driverData, error: driverError } = await this.supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('id', rideData.driver_id)
        .single();

      if (driverError || !driverData) {
        console.error('❌ [ORCHESTRATION] Driver not found:', {
          driverId: rideData.driver_id,
          error: driverError
        });
        return;
      }

      // Create merged booking object in expected format
      const mergedBooking = {
        ...bookingData,
        ride: {
          ...rideData,
          driver: driverData
        },
        user: userData
      };

      console.log('✅ [ORCHESTRATION] Booking and related data fetched successfully');

      // Continue with notification logic using the merged booking
      return this.processNotificationFlow(mergedBooking, payment);
    } catch (error) {
      console.error('Error in completed payment workflow:', error);
      throw error;
    }
  }

  private async processNotificationFlow(booking: any, payment: Payment): Promise<void> {
    try {
      // Generate verification code using database function
      const { data: verificationCodeData, error: codeError } = await this.supabase.rpc(
        'generate_booking_verification_code',
        { booking_id: payment.booking_id }
      );

      if (codeError) {
        console.error('❌ Error generating verification code:', codeError);
      }

      const verificationCode = verificationCodeData || 'ERROR';

      // Fetch the booking again to get the actual verification code from database
      const { data: updatedBooking } = await this.supabase
        .from('bookings')
        .select('verification_code, code_expiry')
        .eq('id', payment.booking_id)
        .single();

      const actualCode = updatedBooking?.verification_code || verificationCode;

      console.log('🔔 [ORCHESTRATION] Booking details fetched:', {
        bookingId: booking.id,
        userId: booking.user.id,
        driverId: booking.ride.driver.id,
        verificationCode: actualCode,
        passengerPhone: booking.user.phone
      });

      // Run independent operations in parallel
      await Promise.all([
        // Create receipt (with error handling for duplicates)
        this.receiptService.createReceipt(payment.id).catch(err => {
          console.warn('⚠️ Receipt creation error (non-critical):', err);
          // Don't throw - receipt creation failure shouldn't block the workflow
        }),

        // Send single push notification to passenger with verification code
        (async () => {
          console.log('🔔 [ORCHESTRATION] Sending push notification to passenger:', booking.user.id);
          const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);
          const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          };
          
          const message = `Votre réservation pour ${booking.ride.from_city} → ${booking.ride.to_city} est confirmée.\n` +
            `Code de vérification: ${actualCode}\n` +
            `Montant: ${formatAmount(payment.amount)} XAF • Date: ${formatDate(booking.ride.departure_time)}\n` +
            `Places: ${booking.seats} • ${booking.user.full_name}\n\n` +
            `📱 Note: Présentez ce code au conducteur à l'embarquement.`;
          
          return this.oneSignalService.sendNotification({
            userId: booking.user.id,
            title: '✅ Paiement Confirmé!',
            message: message,
            notificationType: 'payment_success',
            imageUrl: 'https://pikdrive.com/icons/icon-192x192.png',
            data: {
              bookingId: booking.id,
              rideId: booking.ride.id,
              paymentId: payment.id,
              type: 'payment_completed',
              icon: 'CheckCircle2',
              verificationCode: actualCode,
              action: 'view_booking',
              deepLink: `pikdrive.com/bookings/${booking.id}`,
              priority: 'high'
            },
          });
        })().catch(err => {
          console.error('❌ Passenger notification error (non-critical):', err);
        }),

        // Send single push notification to driver (WITHOUT verification code for security)
        (async () => {
          console.log('🔔 [ORCHESTRATION] Sending push notification to driver:', booking.ride.driver.id);
          const formatAmount = (amt: number) => new Intl.NumberFormat('fr-FR').format(amt);
          const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          };
          
          const message = `${booking.user.full_name} a payé ${formatAmount(payment.amount)} XAF pour votre trajet ${booking.ride.from_city} → ${booking.ride.to_city}.\n` +
            `Places: ${booking.seats} • Date: ${formatDate(booking.ride.departure_time)}\n\n` +
            `🔒 Note: Demandez le code de vérification au passager à l'embarquement.`;
          
          return this.oneSignalService.sendNotification({
            userId: booking.ride.driver.id,
            title: '💰 Nouvelle Réservation Payée!',
            message: message,
            notificationType: 'driver_new_booking',
            imageUrl: 'https://pikdrive.com/icons/icon-192x192.png',
            data: {
              bookingId: booking.id,
              rideId: booking.ride.id,
              paymentId: payment.id,
              passengerName: booking.user.full_name,
              amount: payment.amount,
              seats: booking.seats,
              fromCity: booking.ride.from_city,
              toCity: booking.ride.to_city,
              departureTime: booking.ride.departure_time,
              type: 'driver_booking_paid',
              action: 'view_driver_booking',
              deepLink: `pikdrive.com/driver/bookings/${booking.id}`,
              priority: 'high'
              // NOTE: verificationCode intentionally NOT included for security
            },
          });
        })().catch(err => {
          console.error('❌ Driver notification error (non-critical):', err);
        }),
      ]).then(results => {
        console.log('✅ [ORCHESTRATION] All notification tasks completed:', {
          receiptCreated: results[0] !== null,
          passengerNotification: results[1]?.success !== false,
          driverNotification: results[2]?.success !== false
        });
      }).catch(err => {
        console.error('❌ [ORCHESTRATION] Error in notification tasks:', err);
      });

      console.log('✅ [ORCHESTRATION] Completed payment workflow finished with smart notifications');
    } catch (error) {
      console.error('Error in completed payment workflow:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment workflow
   */
  private async handleFailedPayment(payment: Payment, reason?: string): Promise<void> {
    try {
      // Update booking status
      await this.bookingService.updateBooking(payment.booking_id, {
        payment_status: 'failed',
        status: 'cancelled',
      });

      // Get booking details for SMS notification (using explicit queries to avoid cache issues)
      const { data: bookingData } = await this.supabase
        .from('bookings')
        .select('id, ride_id, user_id')
        .eq('id', payment.booking_id)
        .single();

      if (bookingData) {
        // Fetch ride and user data in parallel
        const [rideResult, userResult] = await Promise.all([
          this.supabase
            .from('rides')
            .select('from_city, to_city')
            .eq('id', bookingData.ride_id)
            .single(),
          this.supabase
            .from('profiles')
            .select('phone')
            .eq('id', bookingData.user_id)
            .single()
        ]);

        const { data: rideData } = rideResult;
        const { data: userData } = userResult;

        if (rideData && userData) {
          // Send SMS to passenger (with retry link)
          this.oneSignalService.sendPaymentFailureSMS(
            userData.phone,
            {
              id: bookingData.id,
              from: rideData.from_city,
              to: rideData.to_city,
              amount: payment.amount,
              paymentId: payment.id,
            },
            reason || 'Paiement non autorisé'
          ).catch(err => {
            console.error('❌ SMS failure notification error (non-critical):', err);
          });
        }
      }

      // Legacy notification service (keep for compatibility)
      this.notificationService.notifyPaymentFailed(payment, reason).catch(err =>
        console.warn('⚠️ Legacy notification error (non-critical):', err)
      );

      console.log('✅ Failed payment workflow finished with smart notifications');
    } catch (error) {
      console.error('Error in failed payment workflow:', error);
      throw error;
    }
  }

  /**
   * Get payment with full details
   */
  async getPaymentWithDetails(paymentId: string): Promise<any> {
    try {
      const payment = await this.paymentService.getPaymentById(paymentId);
      if (!payment) return null;

      // Get booking with explicit columns (avoids PostgREST relationship cache issues)
      const { data: bookingData } = await this.supabase
        .from('bookings')
        .select('*')
        .eq('id', payment.booking_id)
        .single();

      if (!bookingData) {
        return { ...payment, booking: null };
      }

      // Fetch related data in parallel
      const [rideResult, userResult] = await Promise.all([
        this.supabase
          .from('rides')
          .select('*')
          .eq('id', bookingData.ride_id)
          .single(),
        this.supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', bookingData.user_id)
          .single()
      ]);

      const { data: rideData } = rideResult;
      const { data: userData } = userResult;

      if (!rideData) {
        return { ...payment, booking: bookingData };
      }

      // Fetch driver data
      const { data: driverData } = await this.supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', rideData.driver_id)
        .single();

      // Create merged booking object
      const booking = {
        ...bookingData,
        ride: {
          ...rideData,
          driver: driverData || null
        },
        user: userData || null
      };

      return {
        ...payment,
        booking,
      };
    } catch (error) {
      console.error('ServerPaymentOrchestrationService.getPaymentWithDetails error:', error);
      throw error;
    }
  }

  /**
   * Generate activation code for passenger
   */
  private generateActivationCode(): string {
    // Generate a 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
