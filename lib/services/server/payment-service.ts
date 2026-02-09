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
          provider: params.provider, // Column name is 'provider'
          phone_number: params.phone_number,
          transaction_id: params.transaction_id,
          idempotency_key: params.idempotency_key,
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
   * Get payment by transaction ID (with smart fallback logic)
   * 
   * RESILIENCE STRATEGY:
   * 1. Try exact transaction_id match
   * 2. If not found, check for recent pending/processing payments (race condition)
   * 3. Return most recent match
   * 
   * This handles the case where frontend checks before transaction_id is saved
   */
  async getPaymentByTransactionId(transactionId: string): Promise<Payment | null> {
    try {
      console.log('🔍 PaymentService: Searching for transaction_id:', transactionId);
      
      // Primary query: exact match on transaction_id
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 errors

      if (error) {
        console.error('🔍 PaymentService: Database error:', error);
        throw new Error(`Failed to fetch payment: ${error.message}`);
      }

      if (data) {
        console.log('✅ PaymentService: Payment found by transaction_id:', { 
          id: data.id, 
          transaction_id: data.transaction_id,
          status: data.status 
        });
        return data;
      }

      // Fallback: transaction_id might not be set yet (race condition)
      // Search for very recent payments in pending/processing state
      console.log('⚠️ PaymentService: No exact match, checking recent payments...');
      
      const { data: recentPayments, error: recentError } = await this.supabase
        .from('payments')
        .select('*')
        .in('status', ['pending', 'processing'])
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        console.error('🔍 PaymentService: Recent payments query error:', recentError);
        return null;
      }

      if (recentPayments && recentPayments.length > 0) {
        console.log('⚠️ PaymentService: Found recent pending payments:', 
          recentPayments.map(p => ({ 
            id: p.id, 
            transaction_id: p.transaction_id,
            status: p.status,
            created_at: p.created_at 
          }))
        );
        
        // Return the most recent one (likely the one being checked)
        const payment = recentPayments[0];
        console.log('⚠️ PaymentService: Returning most recent payment as fallback:', payment.id);
        return payment;
      }

      console.log('❌ PaymentService: Payment not found (no match or recent payments)');
      return null;
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
        .maybeSingle(); // Use maybeSingle() to avoid 406 errors

      if (error) {
        throw new Error(`Failed to fetch payment: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerPaymentService.getPaymentByBooking error:', error);
      throw error;
    }
  }

  /**
   * Get payment with multiple fallback strategies (ULTRA RESILIENT)
   * 
   * Priority:
   * 1. Search by transaction_id
   * 2. If not found, search by booking_id
   * 3. If still not found, search by idempotency_key
   * 
   * Use this for status checks where you want maximum resilience
   */
  async getPaymentWithFallbacks(params: {
    transactionId?: string;
    bookingId?: string;
    idempotencyKey?: string;
  }): Promise<Payment | null> {
    try {
      // Strategy 1: Try transaction_id
      if (params.transactionId) {
        const payment = await this.getPaymentByTransactionId(params.transactionId);
        if (payment) return payment;
      }

      // Strategy 2: Try booking_id
      if (params.bookingId) {
        console.log('🔄 Fallback: Searching by booking_id:', params.bookingId);
        const payment = await this.getPaymentByBooking(params.bookingId);
        if (payment) {
          console.log('✅ Payment found by booking_id');
          return payment;
        }
      }

      // Strategy 3: Try idempotency_key
      if (params.idempotencyKey) {
        console.log('🔄 Fallback: Searching by idempotency_key:', params.idempotencyKey);
        const payment = await this.getPaymentByIdempotencyKey(params.idempotencyKey);
        if (payment) {
          console.log('✅ Payment found by idempotency_key');
          return payment;
        }
      }

      console.log('❌ Payment not found with any strategy');
      return null;
    } catch (error) {
      console.error('ServerPaymentService.getPaymentWithFallbacks error:', error);
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
        .maybeSingle(); // Use maybeSingle() to avoid 406 errors

      if (error) {
        console.error('ServerPaymentService.getPaymentByIdempotencyKey error:', error);
        return null; // Don't throw, just return null for idempotency checks
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
