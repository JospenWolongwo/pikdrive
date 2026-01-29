import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment, PaymentTransactionStatus } from '@/types';
import { ServerPaymentService } from './payment-service';
import { ServerBookingService } from './booking-service';
import { ServerReceiptService } from './receipt-service';
import { ServerPaymentNotificationService } from './payment-notification-service';
import { ServerOneSignalNotificationService } from './onesignal-notification-service';
import { ServerMultiChannelNotificationService } from './multi-channel-notification-service';

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
  private multiChannelService: ServerMultiChannelNotificationService;

  constructor(private supabase: SupabaseClient) {
    this.paymentService = new ServerPaymentService(supabase);
    this.bookingService = new ServerBookingService(supabase);
    this.receiptService = new ServerReceiptService(supabase);
    this.notificationService = new ServerPaymentNotificationService(supabase);
    this.oneSignalService = new ServerOneSignalNotificationService(supabase);
    this.multiChannelService = new ServerMultiChannelNotificationService(supabase);
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
      // Fetch current booking to check payment_status
      const { data: currentBooking, error: bookingFetchError } = await this.supabase
        .from('bookings')
        .select('payment_status, status')
        .eq('id', payment.booking_id)
        .single();

      if (bookingFetchError) {
        console.error('❌ [ORCHESTRATION] Error fetching booking for payment status check:', bookingFetchError);
        // FIX: Return early if booking doesn't exist yet (race condition: payment completed before booking created)
        // The booking creation will handle reconciliation when it's created
        console.warn('⚠️ [ORCHESTRATION] Booking not found for completed payment - will be reconciled on booking creation:', {
          paymentId: payment.id,
          bookingId: payment.booking_id
        });
        return;
      }

      if (!currentBooking) {
        console.warn('⚠️ [ORCHESTRATION] Booking not found for completed payment - will be reconciled on booking creation:', {
          paymentId: payment.id,
          bookingId: payment.booking_id
        });
        return;
      }

      // Determine new payment_status: if booking was 'partial', set to 'completed'; otherwise 'completed'
      // Note: For partial payments (adding seats to paid booking), set back to 'completed'
      const currentPaymentStatus = currentBooking?.payment_status;
      const newPaymentStatus = currentPaymentStatus === 'partial' ? 'completed' : 'completed';

      // Update booking status
      await this.bookingService.updateBooking(payment.booking_id, {
        payment_status: newPaymentStatus,
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
      // Include pickup point fields from booking
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
      // Include pickup point data from booking
      const mergedBooking = {
        ...bookingData,
        pickup_point_name: bookingData.pickup_point_name,
        pickup_time: bookingData.pickup_time,
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

        // Send multi-channel notification to passenger (OneSignal + WhatsApp)
        (async () => {
          console.log('🔔 [ORCHESTRATION] Sending multi-channel notification to passenger:', booking.user.id);
          
          return this.multiChannelService.sendPaymentConfirmed({
            userId: booking.user.id,
            phoneNumber: booking.user.phone,
            passengerName: booking.user.full_name || 'Passager',
            route: `${booking.ride.from_city} → ${booking.ride.to_city}`,
            departureTime: booking.ride.departure_time,
            pickupPointName: booking.pickup_point_name,
            pickupTime: booking.pickup_time,
            seats: booking.seats,
            amount: payment.amount,
            verificationCode: actualCode,
            bookingId: booking.id,
            paymentId: payment.id,
            rideId: booking.ride.id,
            transactionId: payment.transaction_id,
          });
        })().catch(err => {
          console.error('❌ Passenger notification error (non-critical):', err);
        }),

        // Send multi-channel notification to driver (OneSignal + WhatsApp)
        (async () => {
          console.log('🔔 [ORCHESTRATION] Sending multi-channel notification to driver:', booking.ride.driver.id);
          
          return this.multiChannelService.sendDriverNewBooking({
            driverId: booking.ride.driver.id,
            driverPhone: booking.ride.driver.phone,
            driverName: booking.ride.driver.full_name || 'Chauffeur',
            passengerName: booking.user.full_name || 'Passager',
            route: `${booking.ride.from_city} → ${booking.ride.to_city}`,
            seats: booking.seats,
            amount: payment.amount,
            pickupPointName: booking.pickup_point_name,
            pickupTime: booking.pickup_time,
            departureTime: booking.ride.departure_time,
            bookingId: booking.id,
            rideId: booking.ride.id,
            paymentId: payment.id,
          });
        })().catch(err => {
          console.error('❌ Driver notification error (non-critical):', err);
        }),
      ]).then(results => {
        console.log('✅ [ORCHESTRATION] All notification tasks completed:', {
          receiptCreated: results[0] !== null,
          passengerNotification: results[1]?.onesignal || results[1]?.whatsapp || false,
          driverNotification: results[2]?.onesignal || results[2]?.whatsapp || false,
          passengerWhatsApp: results[1]?.whatsapp || false,
          driverWhatsApp: results[2]?.whatsapp || false,
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
          // Send multi-channel failure notification
          this.multiChannelService.sendPaymentFailed({
            userId: bookingData.user_id,
            phoneNumber: userData.phone,
            passengerName: userData.full_name || 'Passager',
            amount: payment.amount,
            reason: reason || 'Paiement non autorisé',
            retryLink: `pikdrive.com/payments/retry/${payment.id}`,
            paymentId: payment.id,
          }).catch(err => {
            console.error('❌ Payment failure notification error (non-critical):', err);
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
