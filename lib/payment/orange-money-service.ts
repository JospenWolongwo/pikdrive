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
    // Orange Money API base URLs
    this.baseUrl = config.environment === 'production'
      ? 'https://api.orange.com/orange-money-webpay/cm/v1'
      : 'https://api.orange-sonatel.com/orange-money-webpay/cm/v1';
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
  private async calculateSignature(data: string): Promise<string> {
    return await generateHmac(this.config.merchantKey, data);
  }

  /**
   * Get authentication token for API requests
   */
  private async getAuthToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expires > new Date()) {
      return this.tokenCache.token;
    }

    const authUrl = `${this.baseUrl}/token`;

    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          merchant_id: this.config.merchantId,
          merchant_key: this.config.merchantKey,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Auth response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Failed to get auth token: ${response.statusText}`);
      }

      const data = await response.json();
      const expiresIn = data.expires_in || 3600; // Default to 1 hour if not specified
      
      this.tokenCache = {
        token: data.access_token,
        expires: new Date(Date.now() + (expiresIn * 1000)),
      };

      return this.tokenCache.token;
    } catch (error) {
      console.error('🔴 Failed to get auth token:', error);
      throw error;
    }
  }

  /**
   * Initiate a payment request
   */
  async initiatePayment(request: {
    amount: number;
    phoneNumber: string;
    description: string;
    externalId?: string;
  }): Promise<PaymentResponse> {
    try {
      const token = await this.getAuthToken();
      const reference = request.externalId || this.generateReference();

      const paymentData = {
        amount: request.amount.toString(),
        currency: 'XAF',
        externalId: reference,
        customerPhoneNumber: request.phoneNumber,
        description: request.description,
        notificationUrl: this.config.notificationUrl,
        returnUrl: this.config.returnUrl,
        metadata: {
          reference,
          phoneNumber: request.phoneNumber
        }
      };

      const signature = await this.calculateSignature(JSON.stringify(paymentData));

      const response = await fetch(`${this.baseUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Signature': signature
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Payment initiation failed:', {
          status: response.status,
          error: errorText
        });
        return {
          success: false,
          status: 'failed' as PaymentStatus,
          message: 'Payment initiation failed',
          error: errorText
        };
      }

      const data = await response.json();
      return {
        success: true,
        status: 'processing' as PaymentStatus,
        transactionId: data.paymentId,
        message: 'Payment initiated successfully'
      };
    } catch (error) {
      console.error('🔴 Payment error:', error);
      return {
        success: false,
        status: 'failed' as PaymentStatus,
        message: 'Payment processing error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check the status of a payment
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.baseUrl}/payments/${transactionId}`, {
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
  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    const calculatedSignature = await generateHmac(this.config.merchantKey, payload);
    return calculatedSignature === signature;
  }
}

async function generateHmac(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
