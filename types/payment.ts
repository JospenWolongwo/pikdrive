export interface Payment {
  readonly id: string;
  readonly booking_id: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentTransactionStatus;
  readonly provider: PaymentMethod; // Database column is 'provider'
  readonly transaction_id?: string;
  readonly phone_number?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export type PaymentTransactionStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 
  | 'mtn'
  | 'orange'
  | 'card'
  | 'cash'
  | 'bank_transfer';

// Alias for backward compatibility
export type PaymentProvider = 'mtn' | 'orange';

export interface MomoPayment {
  readonly id: string;
  readonly booking_id: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentTransactionStatus;
  readonly momo_transaction_id?: string;
  readonly phone_number: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreatePaymentRequest {
  readonly booking_id: string;
  readonly amount: number;
  readonly provider: PaymentMethod; // Database column is 'provider'
  readonly phone_number?: string; // For Momo payments
  readonly idempotency_key?: string;
}

export interface PaymentResponse {
  readonly success: boolean;
  readonly transaction_id?: string;
  readonly status: PaymentTransactionStatus;
  readonly message?: string;
}

export interface PaymentCheckRequest {
  readonly bookingId: string;
  readonly transactionId: string;
  readonly provider: string;
}
