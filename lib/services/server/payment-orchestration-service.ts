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

      // Get booking and ride details for notifications
      const { data: booking } = await this.supabase
        .from('bookings')
        .select(`
          *,
          ride:ride_id (
            *,
            driver:driver_id (
              id,
              full_name,
              phone
            )
          ),
          user:user_id (
            id,
            full_name,
            phone
          )
        `)
        .eq('id', payment.booking_id)
        .single();

      if (!booking) {
        console.error('❌ Booking not found for payment:', payment.id);
        return;
      }

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

        // Send SMS to passenger with verification code (critical info)
        (async () => {
          console.log('🔔 [ORCHESTRATION] Sending SMS to passenger:', booking.user.phone);
          return this.oneSignalService.sendBookingConfirmationSMS(
          booking.user.phone,
          {
            id: booking.id,
            from: booking.ride.from_city,
            to: booking.ride.to_city,
            date: booking.ride.departure_time,
            amount: payment.amount,
          },
            actualCode
          );
        })().catch(err => {
          console.error('❌ SMS notification error (non-critical):', err);
        }),

        // Send push notification to driver (ride update)
        (async () => {
          console.log('🔔 [ORCHESTRATION] Sending push to driver:', booking.ride.driver.id);
          return this.oneSignalService.sendDriverNotification(
          booking.ride.driver.id,
          'new_booking',
          {
            id: booking.id,
            rideId: booking.ride.id,
            passengerName: booking.user.full_name,
            from: booking.ride.from_city,
            to: booking.ride.to_city,
            date: booking.ride.departure_time,
            seats: booking.seats,
            amount: payment.amount,
          }
        );
        })().catch(err => {
          console.error('❌ Driver notification error (non-critical):', err);
        }),

        // Legacy notification service (keep for compatibility)
        (async () => {
          console.log('🔔 [ORCHESTRATION] Calling legacy notification service');
          try {
            await this.notificationService.notifyPaymentCompleted(payment);
            console.log('✅ Legacy payment notifications sent successfully for payment:', payment.id);
          } catch (err) {
            console.error('❌ Legacy notification error (non-critical):', err);
          }
        })(),
      ]).then(results => {
        console.log('✅ [ORCHESTRATION] All notification tasks completed:', {
          receiptCreated: results[0] !== null,
          smsSent: results[1]?.success !== false,
          driverNotification: results[2]?.success !== false,
          legacyNotification: results[3] !== undefined // Legacy returns void
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

      // Get booking details for SMS notification
      const { data: booking } = await this.supabase
        .from('bookings')
        .select(`
          *,
          ride:ride_id (
            from_city,
            to_city
          ),
          user:user_id (
            phone
          )
        `)
        .eq('id', payment.booking_id)
        .single();

      if (booking) {
        // Send SMS to passenger (with retry link)
        this.oneSignalService.sendPaymentFailureSMS(
          booking.user.phone,
          {
            id: booking.id,
            from: booking.ride.from_city,
            to: booking.ride.to_city,
            amount: payment.amount,
            paymentId: payment.id,
          },
          reason || 'Paiement non autorisé'
        ).catch(err => {
          console.error('❌ SMS failure notification error (non-critical):', err);
        });
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

      // Get related data
      const { data: booking } = await this.supabase
        .from('bookings')
        .select(`
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
        `)
        .eq('id', payment.booking_id)
        .single();

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
