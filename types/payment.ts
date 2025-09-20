export interface Payment {
  readonly id: string;
  readonly booking_id: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentTransactionStatus;
  readonly payment_method: PaymentMethod;
  readonly transaction_id?: string;
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
  | 'momo'
  | 'card'
  | 'cash'
  | 'bank_transfer';

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
  readonly payment_method: PaymentMethod;
  readonly phone_number?: string; // For Momo payments
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
