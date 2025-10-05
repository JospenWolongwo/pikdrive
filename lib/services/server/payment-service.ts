import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payment, CreatePaymentRequest, PaymentTransactionStatus } from '@/types';

export interface PaymentSearchParams {
  userId?: string;
  bookingId?: string;
  status?: PaymentTransactionStatus;
  page?: number;
  limit?: number;
}

/**
 * Server-side PaymentService for use in API routes
 * Uses direct Supabase client access (no HTTP calls)
 * 
 * SINGLE RESPONSIBILITY: Payment CRUD operations only
 * Does NOT handle:
 * - Booking updates (use ServerBookingService)
 * - Notifications (use ServerNotificationService)
 * - Receipts (use ServerReceiptService)
 * - Provider integrations (use provider-specific services)
 */
export class ServerPaymentService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a payment record
   */
  async createPayment(params: CreatePaymentRequest & { 
    transaction_id?: string;
    idempotency_key?: string;
  }): Promise<Payment> {
    try {
      // Check for existing payment with idempotency key
      if (params.idempotency_key) {
        const existing = await this.getPaymentByIdempotencyKey(params.idempotency_key);
        if (existing) {
          console.log('Payment already exists for idempotency key:', params.idempotency_key);
          return existing;
        }
      }

      const { data: payment, error } = await this.supabase
        .from('payments')
        .insert({
          booking_id: params.booking_id,
          amount: params.amount,
          currency: 'XAF',
          status: 'pending',
          payment_method: params.payment_method,
          transaction_id: params.transaction_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('ServerPaymentService.createPayment error:', error);
        throw new Error(`Failed to create payment: ${error.message}`);
      }

      return payment;
    } catch (error) {
      console.error('ServerPaymentService.createPayment error:', error);
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Payment not found
        }
        throw new Error(`Failed to fetch payment: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerPaymentService.getPaymentById error:', error);
      throw error;
    }
  }

  /**
   * Get payment by transaction ID
   */
  async getPaymentByTransactionId(transactionId: string): Promise<Payment | null> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Payment not found
        }
        throw new Error(`Failed to fetch payment: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerPaymentService.getPaymentByTransactionId error:', error);
      throw error;
    }
  }

  /**
   * Get payment by booking ID
   */
  async getPaymentByBooking(bookingId: string): Promise<Payment | null> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Payment not found
        }
        throw new Error(`Failed to fetch payment: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerPaymentService.getPaymentByBooking error:', error);
      throw error;
    }
  }

  /**
   * Get payment by idempotency key
   */
  async getPaymentByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Payment not found
        }
        throw new Error(`Failed to fetch payment: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerPaymentService.getPaymentByIdempotencyKey error:', error);
      return null; // Don't throw, just return null for idempotency checks
    }
  }

  /**
   * Get user's payments
   */
  async getUserPayments(params: PaymentSearchParams): Promise<Payment[]> {
    try {
      let query = this.supabase
        .from('payments')
        .select('*')
        .eq('user_id', params.userId!)
        .order('created_at', { ascending: false });

      if (params.status) {
        query = query.eq('status', params.status);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch user payments: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('ServerPaymentService.getUserPayments error:', error);
      throw error;
    }
  }

  /**
   * Update payment status and metadata
   */
  async updatePaymentStatus(
    paymentId: string, 
    status: PaymentTransactionStatus,
    metadata?: {
      transaction_id?: string;
      provider_response?: any;
      error_message?: string;
    }
  ): Promise<Payment> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Set payment_time when completed
      if (status === 'completed') {
        updateData.payment_time = new Date().toISOString();
      }

      // Add optional metadata
      if (metadata?.transaction_id) {
        updateData.transaction_id = metadata.transaction_id;
      }

      const { data, error } = await this.supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update payment: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerPaymentService.updatePaymentStatus error:', error);
      throw error;
    }
  }

  /**
   * Validate state transition
   */
  validateStateTransition(
    currentStatus: PaymentTransactionStatus,
    newStatus: PaymentTransactionStatus
  ): boolean {
    const validTransitions: Record<PaymentTransactionStatus, PaymentTransactionStatus[]> = {
      pending: ['processing', 'failed', 'cancelled'],
      processing: ['completed', 'failed'],
      completed: ['refunded'],
      failed: [],
      cancelled: [],
      refunded: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Check if payment can be retried
   */
  canRetryPayment(payment: Payment): boolean {
    return ['failed', 'cancelled'].includes(payment.status);
  }

  /**
   * Check if payment is in final state
   */
  isPaymentFinalized(payment: Payment): boolean {
    return ['completed', 'refunded', 'cancelled'].includes(payment.status);
  }
}
