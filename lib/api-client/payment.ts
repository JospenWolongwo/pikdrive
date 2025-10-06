import { apiClient } from './index';
import type { Payment, CreatePaymentRequest, PaymentTransactionStatus } from '@/types';

export interface PaymentApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaymentStatusResult {
  readonly success: boolean;
  readonly status: PaymentTransactionStatus;
  readonly message?: string;
}

export interface CreatePaymentParams {
  readonly booking_id: string;
  readonly amount: number;
  readonly provider: string;
  readonly phone_number: string;
}

/**
 * Payment API client methods
 * Client-side HTTP calls to payment API routes
 */
export class PaymentApiClient {
  /**
   * Create a new payment
   */
  async createPayment(params: CreatePaymentRequest): Promise<PaymentApiResponse<Payment>> {
    return apiClient.post('/api/payments/create', {
      bookingId: params.booking_id,
      amount: params.amount,
      provider: params.provider,
      phoneNumber: params.phone_number,
    });
  }

  /**
   * Check payment status (with optional bookingId for fallback)
   */
  async checkPaymentStatus(
    transactionId: string, 
    provider: string,
    bookingId?: string
  ): Promise<PaymentApiResponse<PaymentStatusResult>> {
    return apiClient.post('/api/payments/check-status', {
      transactionId,
      provider,
      bookingId, // Optional fallback for resilient querying
    });
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<PaymentApiResponse<Payment>> {
    return apiClient.get(`/api/payments/${paymentId}`);
  }

  /**
   * Get user's payments
   */
  async getUserPayments(userId: string): Promise<PaymentApiResponse<Payment[]>> {
    const searchParams = new URLSearchParams({ userId });
    return apiClient.get(`/api/payments?${searchParams}`);
  }

  /**
   * Get payment by booking ID
   */
  async getPaymentByBooking(bookingId: string): Promise<PaymentApiResponse<Payment | null>> {
    const searchParams = new URLSearchParams({ bookingId });
    return apiClient.get(`/api/payments/booking?${searchParams}`);
  }

  /**
   * Get available payment providers
   */
  async getAvailableProviders(): Promise<PaymentApiResponse<any[]>> {
    return apiClient.get('/api/payments/providers');
  }
}

// Export singleton instance
export const paymentApiClient = new PaymentApiClient();
