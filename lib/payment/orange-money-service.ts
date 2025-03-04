import { createHmac } from 'crypto';
import { PaymentResponse, PaymentStatus } from './types';

interface OrangeMoneyConfig {
  merchantId: string;
  merchantKey: string;
  environment: 'sandbox' | 'production';
  notificationUrl: string;
  returnUrl: string;
}

interface PaymentRequest {
  amount: string;
  currency: string;
  externalId: string;
  customerPhoneNumber: string;
  description: string;
}

export class OrangeMoneyService {
  private baseUrl: string;
  private config: OrangeMoneyConfig;
  private tokenCache: { token: string; expires: Date } | null = null;

  constructor(config: OrangeMoneyConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.orange.com/orange-money-webpay'
      : 'https://api.sandbox.orange.com/orange-money-webpay';
  }

  /**
   * Generate a unique reference for the transaction
   */
  private generateReference(): string {
    return `PKD-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Calculate signature for request authentication
   */
  private calculateSignature(data: string): string {
    return createHmac('sha256', this.config.merchantKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Get authentication token for API requests
   */
  private async getAuthToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expires > new Date()) {
      return this.tokenCache.token;
    }

    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        merchant_id: this.config.merchantId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get auth token');
    }

    const data = await response.json();
    this.tokenCache = {
      token: data.access_token,
      expires: new Date(Date.now() + (data.expires_in * 1000)),
    };

    return this.tokenCache.token;
  }

  /**
   * Initiate a payment request
   */
  async initiatePayment(
    amount: number,
    phoneNumber: string,
    reference: string
  ): Promise<PaymentResponse> {
    try {
      const token = await this.getAuthToken();
      const paymentData: PaymentRequest = {
        amount: amount.toString(),
        currency: 'XAF',
        externalId: reference,
        customerPhoneNumber: phoneNumber,
        description: `PikDrive Ride Payment - ${reference}`,
      };

      const signature = this.calculateSignature(JSON.stringify(paymentData));
      
      const response = await fetch(`${this.baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Merchant-Id': this.config.merchantId,
          'X-Signature': signature,
        },
        body: JSON.stringify({
          ...paymentData,
          notificationUrl: this.config.notificationUrl,
          returnUrl: this.config.returnUrl,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('🔴 Orange Money payment initiation failed:', responseData);
        return {
          success: false,
          status: 'failed' as PaymentStatus,
          message: 'Payment initiation failed',
          error: responseData.message || 'Unknown error occurred',
        };
      }

      console.log('🟢 Orange Money payment initiated:', responseData);
      return {
        success: true,
        transactionId: responseData.paymentId,
        status: 'processing' as PaymentStatus,
        message: 'Payment initiated successfully',
      };
    } catch (error) {
      console.error('🔴 Orange Money service error:', error);
      return {
        success: false,
        status: 'failed' as PaymentStatus,
        message: 'Payment service error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Check the status of a payment
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.baseUrl}/v1/payments/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Merchant-Id': this.config.merchantId,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('🔴 Orange Money status check failed:', data);
        return {
          success: false,
          status: 'failed' as PaymentStatus,
          message: 'Failed to check payment status',
          error: data.message || 'Unknown error occurred',
        };
      }

      // Map Orange Money status to our PaymentStatus
      const statusMap: Record<string, PaymentStatus> = {
        'PENDING': 'pending',
        'PROCESSING': 'processing',
        'SUCCESSFUL': 'completed',
        'FAILED': 'failed',
        'CANCELLED': 'failed',
      };

      const status = statusMap[data.status] || 'pending';
      const success = status === 'completed';

      console.log(`🟡 Orange Money payment status: ${status}`, data);
      
      return {
        success,
        transactionId,
        status,
        message: data.message || `Payment ${status}`,
      };
    } catch (error) {
      console.error('🔴 Orange Money service error:', error);
      return {
        success: false,
        status: 'failed' as PaymentStatus,
        message: 'Error checking payment status',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Verify webhook signature from Orange Money
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const calculatedSignature = this.calculateSignature(payload);
    return calculatedSignature === signature;
  }
}
