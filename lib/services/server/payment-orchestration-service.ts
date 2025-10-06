import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment, PaymentTransactionStatus } from '@/types';
import { ServerPaymentService } from './payment-service';
import { ServerBookingService } from './booking-service';
import { ServerReceiptService } from './receipt-service';
import { ServerPaymentNotificationService } from './payment-notification-service';

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

  constructor(private supabase: SupabaseClient) {
    this.paymentService = new ServerPaymentService(supabase);
    this.bookingService = new ServerBookingService(supabase);
    this.receiptService = new ServerReceiptService(supabase);
    this.notificationService = new ServerPaymentNotificationService(supabase);
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
      // Run independent operations in parallel
      await Promise.all([
        // Update booking status
        this.bookingService.updateBooking(payment.booking_id, {
          payment_status: 'completed',
          status: 'pending_verification',
        }),

        // Create receipt (with error handling for duplicates)
        this.receiptService.createReceipt(payment.id).catch(err => {
          console.warn('⚠️ Receipt creation error (non-critical):', err);
          // Don't throw - receipt creation failure shouldn't block the workflow
        }),

        // Send notifications (non-blocking)
        this.notificationService.notifyPaymentCompleted(payment)
          .then(() => {
            console.log('✅ Payment notifications sent successfully for payment:', payment.id);
          })
          .catch(err => {
            console.error('❌ Notification error (non-critical):', err);
          }),
      ]);

      console.log('✅ Completed payment workflow finished');
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

      // Send failure notification (non-blocking)
      this.notificationService.notifyPaymentFailed(payment, reason).catch(err =>
        console.warn('⚠️ Notification error (non-critical):', err)
      );

      console.log('✅ Failed payment workflow finished');
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
}
