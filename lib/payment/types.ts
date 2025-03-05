export type PaymentProviderType = 'mtn' | 'orange';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface PaymentRequest {
  bookingId: string;
  amount: number;
  provider: PaymentProviderType;
  phoneNumber: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status: PaymentStatus;
  message: string;
  error?: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProviderType;
  transactionId?: string;
  phoneNumber: string;
  paymentTime?: Date;
  metadata?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentProvider {
  name: string;
  logo: string;
  description: string;
  minimumAmount: number;
  maximumAmount: number;
  processingFee: number;
  processingTime: string;
}
