import { PaymentResponse, PaymentStatus } from './types';

interface MockOrangeMoneyConfig {
  merchantId: string;
  merchantKey: string;
  environment: 'sandbox' | 'production';
  notificationUrl: string;
  returnUrl: string;
}

interface OrangeMoneyConfig {
  notificationUrl: string;
}

interface OrangeMoneyPaymentParams {
  amount: number;
  phoneNumber: string;
  description: string;
  externalId: string;
}

interface OrangeMoneyPaymentResponse {
  status: string;
  transactionId: string;
  message: string;
  redirectUrl: string;
}

export class MockOrangeMoneyService {
  private config: MockOrangeMoneyConfig;

  constructor(config: MockOrangeMoneyConfig) {
    this.config = config;
  }

  async initiatePayment(request: {
    amount: number;
    phoneNumber: string;
    description: string;
    externalId: string;
  }): Promise<PaymentResponse> {
    const transactionId = `MOCK-${Date.now()}`;
    console.log('🎭 Mock payment initiated with externalId:', request.externalId);

    // Simulate payment processing based on phone number
    switch (request.phoneNumber) {
      case '237699000001':
        // Send success callback after a short delay
        setTimeout(() => {
          this.sendCallback({
            status: 'SUCCESSFUL',
            transactionId,
            externalId: request.externalId,
            message: 'Payment successful'
          });
        }, 3000);
        break;
      case '237699000002':
        // Send failure callback after a short delay
        setTimeout(() => {
          this.sendCallback({
            status: 'FAILED',
            transactionId,
            externalId: request.externalId,
            message: 'Insufficient funds'
          });
        }, 3000);
        break;
      default:
        // Send timeout callback after a longer delay
        setTimeout(() => {
          this.sendCallback({
            status: 'FAILED',
            transactionId,
            externalId: request.externalId,
            message: 'Payment timeout'
          });
        }, 30000);
    }

    // Return success response
    return {
      success: true,
      status: 'completed' as PaymentStatus,
      transactionId,
      message: 'Payment successful'
    };
  }

  private async sendCallback(data: {
    status: string;
    transactionId: string;
    externalId: string;
    message: string;
  }) {
    if (!this.config.notificationUrl) {
      console.error('❌ No callback URL configured');
      return;
    }

    console.log('🎭 Sending mock callback:', data);
    
    const maxRetries = 3;
    let currentRetry = 0;

    while (currentRetry < maxRetries) {
      try {
        currentRetry++;
        console.log(`🎭 Attempt ${currentRetry}/${maxRetries} - Sending mock callback to:`, this.config.notificationUrl);
        console.log('🎭 Callback data:', data);

        const response = await fetch(this.config.notificationUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Mock callback failed: ${response.status} ${errorText}`);
        }

        const responseData = await response.json();
        console.log('✅ Mock callback sent successfully:', responseData);
        return;
      } catch (error) {
        console.error(`❌ Mock callback error (attempt ${currentRetry}/${maxRetries}):`, error);
        
        if (currentRetry === maxRetries) {
          console.error('❌ Failed to send success callback:', error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetry) * 1000));
      }
    }
  }

  /**
   * Mock payment status check
   */
  async checkPaymentStatus(transactionId: string): Promise<PaymentResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Extract scenario from transaction ID if it's a test one
    if (transactionId.startsWith('MOCK-')) {
      return {
        success: true,
        status: 'completed' as PaymentStatus,
        transactionId,
        message: 'Payment completed successfully',
      };
    }

    return {
      success: false,
      status: 'failed' as PaymentStatus,
      transactionId,
      message: 'Payment failed: Invalid phone number',
      error: 'Invalid phone number format'
    };
  }
}
