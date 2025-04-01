import { Buffer } from 'buffer';

interface SMSConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  environment: 'sandbox' | 'production';
}

interface SMSMessage {
  to: string;
  message: string;
  templateId?: string;
}

export class SMSService {
  private config: SMSConfig;
  private baseUrl = 'https://api.twilio.com/2010-04-01';

  constructor(config: SMSConfig) {
    this.config = config;
  }

  /**
   * Send an SMS message using Twilio's REST API directly
   */
  async sendMessage(data: SMSMessage): Promise<{ success: boolean; messageId?: string; error?: string; sandbox?: boolean; message?: string }> {
    try {
      if (this.config.environment === 'sandbox') {
        console.log('🏖️ SMS Service in sandbox mode');
        console.log('📱 Would send SMS:', data);
        
        // In sandbox mode, simulate a success response but add more information
        // about how to enable real SMS sending
        console.log('ℹ️ To enable real SMS sending:');
        console.log('1️⃣ Create a .env.local file in your project root');
        console.log('2️⃣ Add the following environment variables:');
        console.log('   TWILIO_ACCOUNT_SID=your_account_sid');
        console.log('   TWILIO_AUTH_TOKEN=your_auth_token');
        console.log('   TWILIO_FROM_NUMBER=your_twilio_phone_number');
        console.log('3️⃣ Set NODE_ENV=production or modify SMSService constructor call');
        
        return { 
          success: true, 
          messageId: 'sandbox_' + Date.now(),
          sandbox: true,
          message: 'SMS not actually sent - running in sandbox mode'
        };
      }

      const credentials = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
      
      const formData = new URLSearchParams();
      formData.append('To', data.to);
      formData.append('From', this.config.fromNumber);
      formData.append('Body', data.message);

      const response = await fetch(
        `${this.baseUrl}/Accounts/${this.config.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send SMS');
      }

      console.log('📱 SMS sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('🔴 SMS sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  }

  /**
   * Get payment confirmation message
   */
  getPaymentConfirmationMessage(data: {
    amount: number;
    provider: string;
    transactionId: string;
    bookingId: string;
  }): string {
    const { amount, provider, transactionId, bookingId } = data;
    return `PikDrive: Payment confirmed! ${amount} XAF via ${provider}. ID: ${transactionId}. Booking: ${bookingId}. Safe travels! 🚗`;
  }

  /**
   * Get payment failure message
   */
  getPaymentFailureMessage(data: {
    amount: number;
    provider: string;
    bookingId: string;
  }): string {
    const { amount, provider, bookingId } = data;
    return `PikDrive: Payment of ${amount} XAF via ${provider} failed. Please try again or contact support. Booking: ${bookingId}`;
  }

  /**
   * Get ride confirmation message
   */
  getRideConfirmationMessage(data: {
    driverName: string;
    pickupTime: string;
    bookingId: string;
  }): string {
    const { driverName, pickupTime, bookingId } = data;
    return `PikDrive: Your ride is confirmed! Driver: ${driverName}. Pickup: ${pickupTime}. Booking: ${bookingId}. Have a great ride! 🚗`;
  }

  /**
   * Send a payment notification SMS
   */
  async sendPaymentNotification(
    phoneNumber: string,
    amount: number,
    success: boolean
  ): Promise<{ success: boolean; messageId?: string; error?: string; sandbox?: boolean; message?: string }> {
    const message = success
      ? `✅ Your payment of ${amount} XAF has been successfully processed. Thank you for using PikDrive!`
      : `❌ Your payment of ${amount} XAF was not successful. Please try again or contact support if the issue persists.`;

    return this.sendMessage({
      to: phoneNumber,
      message
    });
  }
}
