import { SupabaseClient } from '@supabase/supabase-js';
import { PaymentRequest, PaymentResponse, PaymentStatus, Payment } from './types';
import { MTNMomoService } from './mtn-momo-service';
import { OrangeMoneyService } from './orange-money-service';
import { MockOrangeMoneyService } from './mock-orange-money-service';
import { SMSService } from '@/lib/notifications/sms-service';

export class PaymentService {
  private supabase: SupabaseClient;
  private mtnMomoService: MTNMomoService;
  private orangeMoneyService: OrangeMoneyService | MockOrangeMoneyService;
  private smsService: SMSService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.mtnMomoService = new MTNMomoService({
      subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY!,
      apiKey: process.env.MOMO_API_KEY!,
      targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      callbackHost: process.env.MOMO_CALLBACK_HOST!,
      collectionPrimaryKey: process.env.MOMO_COLLECTION_PRIMARY_KEY!,
      collectionUserId: process.env.MOMO_COLLECTION_USER_ID!
    });

    const orangeConfig = {
      merchantId: process.env.ORANGE_MONEY_MERCHANT_ID || '',
      merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || '',
      environment: (process.env.ORANGE_MONEY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
      notificationUrl: process.env.ORANGE_MONEY_NOTIFICATION_URL,
      returnUrl: process.env.ORANGE_MONEY_RETURN_URL
    };

    // Use mock service if merchant credentials are not set
    if (!orangeConfig.merchantId || !orangeConfig.merchantKey || process.env.USE_MOCK_ORANGE_MONEY === 'true') {
      console.log('🟡 Using Mock Orange Money Service');
      this.orangeMoneyService = new MockOrangeMoneyService(orangeConfig);
    } else {
      this.orangeMoneyService = new OrangeMoneyService(orangeConfig);
    }

    this.smsService = new SMSService({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      fromNumber: process.env.TWILIO_FROM_NUMBER!,
      environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox')
    });
  }

  private async createPaymentRecord(data: {
    bookingId: string;
    amount: number;
    provider: string;
    phoneNumber: string;
    transactionId?: string;
  }) {
    try {
      console.log('Creating payment record with data:', data);
      
      const { data: payment, error } = await this.supabase
        .from('payments')
        .insert({
          booking_id: data.bookingId,
          amount: data.amount,
          provider: data.provider,
          phone_number: data.phoneNumber,
          transaction_id: data.transactionId,
          status: 'pending',
          currency: 'XAF'
        })
        .select('*')
        .single();

      if (error) {
        console.error('❌ Supabase error creating payment:', error);
        throw error;
      }
      
      console.log('✅ Successfully created payment record:', payment);
      return payment;
    } catch (error) {
      console.error('❌ Error in createPaymentRecord:', error);
      throw error;
    }
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Format phone number
      const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
      console.log('📱 Formatted phone number:', formattedPhone);

      // Validate phone number
      if (!await this.validatePhoneNumber(formattedPhone)) {
        throw new Error('Invalid phone number');
      }

      // Create payment record first
      const payment = await this.createPaymentRecord({
        bookingId: request.bookingId,
        amount: request.amount,
        provider: request.provider,
        phoneNumber: formattedPhone
      });

      console.log('💳 Created payment record:', payment);

      // Handle payment based on provider
      if (request.provider === 'mtn') {
        return this.handleMTNPayment(payment, formattedPhone, request);
      } else if (request.provider === 'orange') {
        return this.handleOrangePayment(payment, formattedPhone, request);
      } else {
        throw new Error(`Unsupported payment provider: ${request.provider}`);
      }
    } catch (error) {
      console.error('❌ Error in createPayment:', error);
      return {
        success: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Payment creation failed',
      };
    }
  }

  private async handleMTNPayment(
    payment: Payment,
    formattedPhone: string,
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    // In sandbox, use test flow for non-test numbers
    if (process.env.MOMO_TARGET_ENVIRONMENT === 'sandbox') {
      console.log(' Using sandbox environment with test number:', formattedPhone);
      if (formattedPhone !== '237670000000') {
        console.warn(' Not a sandbox test number, defaulting to successful flow');
        return this.mockPaymentProcess(request);
      }
    }

    // Request payment from MTN MOMO
    const momoResponse = await this.mtnMomoService.requestToPay({
      amount: request.amount,
      currency: 'XAF',
      phoneNumber: formattedPhone,
      externalId: payment.id,
      payerMessage: `Payment for booking ${request.bookingId}`,
      payeeNote: `PikDrive booking payment`,
      callbackUrl: `${process.env.MOMO_CALLBACK_HOST}/api/payments/callback`
    });

    // Update payment record with transaction ID
    if (momoResponse.transactionId) {
      const { error: updateError } = await this.supabase
        .from('payments')
        .update({
          transaction_id: momoResponse.transactionId,
          status: 'processing'
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Error updating payment record:', updateError);
      }
    }

    return {
      success: true,
      transactionId: momoResponse.transactionId,
      status: 'processing',
      message: 'Payment request initiated successfully'
    };
  }

  private async handleOrangePayment(
    payment: Payment,
    formattedPhone: string,
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    try {
      console.log('🟠 Initiating Orange Money payment:', { payment, formattedPhone });

      // Initiate payment
      const response = await this.orangeMoneyService.initiatePayment({
        amount: request.amount,
        phoneNumber: formattedPhone,
        description: `PikDrive Ride Payment - ${request.bookingId}`,
        externalId: payment.id,
      });

      console.log('🟠 Orange Money response:', response);

      // Update payment record with transaction ID
      if (response.transactionId) {
        const { error: updateError } = await this.supabase
          .from('payments')
          .update({
            transaction_id: response.transactionId,
            status: response.status === 'success' ? 'completed' : 'pending',
          })
          .eq('id', payment.id);

        if (updateError) {
          console.error('❌ Error updating payment record:', updateError);
        }
      }

      return response;
    } catch (error) {
      console.error('❌ Error in handleOrangePayment:', error);
      throw error;
    }
  }

  async checkPaymentStatus(transactionId: string, provider: string): Promise<{
    success: boolean;
    status: PaymentStatus;
    message?: string;
  }> {
    try {
      // Get payment record
      const { data: payment, error: paymentError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (paymentError) throw new Error('Payment not found');

      if (provider === 'mtn') {
        const momoStatus = await this.mtnMomoService.getPaymentStatus(transactionId);
        console.log(' MTN MOMO Status:', { transactionId, status: momoStatus.status, reason: momoStatus.reason });

        // Map MTN MOMO status to our payment status enum values
        let paymentStatus: PaymentStatus;
        console.log(' Before status mapping:', momoStatus.status);
        
        switch (momoStatus.status) {
          case 'SUCCESSFUL':
            paymentStatus = 'completed';
            break;
          case 'FAILED':
            paymentStatus = 'failed';
            break;
          case 'PENDING':
            paymentStatus = 'processing';
            break;
          default:
            paymentStatus = 'pending';
        }
        
        console.log(' After status mapping:', paymentStatus);

        // Double check that we have a valid enum value
        if (!['pending', 'processing', 'completed', 'failed', 'refunded'].includes(paymentStatus)) {
          console.error(' Invalid payment status:', paymentStatus);
          throw new Error(`Invalid payment status: ${paymentStatus}`);
        }

        // Update payment record if status has changed
        if (paymentStatus !== payment.status) {
          console.log(' Updating payment status:', { 
            from: payment.status, 
            to: paymentStatus,
            paymentId: payment.id 
          });

          // Update payment status
          const { error: updateError } = await this.supabase
            .from('payments')
            .update({
              status: paymentStatus,
              payment_time: paymentStatus === 'completed' ? new Date().toISOString() : null,
              metadata: {
                ...payment.metadata,
                financialTransactionId: momoStatus.financialTransactionId,
                reason: momoStatus.reason
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

          if (updateError) {
            console.error(' Error updating payment:', updateError);
            throw updateError;
          }

          // If payment is completed, update booking and create receipt
          if (paymentStatus === 'completed') {
            // Update booking
            const { error: bookingError } = await this.supabase
              .from('bookings')
              .update({
                status: 'confirmed',
                payment_status: paymentStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', payment.booking_id);

            if (bookingError) {
              console.error(' Error updating booking:', bookingError);
              throw bookingError;
            }

            // Create receipt
            await this.createReceipt(payment.id);
          } else if (paymentStatus === 'failed') {
            // Update booking for failed payment
            const { error: bookingError } = await this.supabase
              .from('bookings')
              .update({
                status: 'cancelled',
                payment_status: paymentStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', payment.booking_id);

            if (bookingError) {
              console.error(' Error updating booking:', bookingError);
              throw bookingError;
            }
          }

          console.log(' Payment and booking updated successfully');
        }

        return {
          success: true,
          status: paymentStatus,
          message: paymentStatus === 'completed'
            ? 'Payment completed successfully! Your seats have been reserved.'
            : paymentStatus === 'failed'
            ? `Payment failed: ${momoStatus.reason || 'Unknown reason'}`
            : 'Payment is being processed'
        };
      }

      // For other providers...
      return {
        success: true,
        status: payment.status as PaymentStatus,
        message: 'Payment status retrieved'
      };
    } catch (error) {
      throw error;
    }
  }

  async getPaymentByTransactionId(transactionId: string): Promise<Payment | null> {
    try {
      // First try to find by transaction_id
      const { data: paymentByTxId, error: txError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (paymentByTxId) {
        return paymentByTxId;
      }

      // If not found, try to find by id (for mock payments where externalId is the payment id)
      const { data: paymentById, error: idError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (idError) {
        console.error('Error fetching payment:', idError);
        return null;
      }

      return paymentById;
    } catch (error) {
      console.error('Error fetching payment:', error);
      return null;
    }
  }

  async handlePaymentCallback(
    provider: 'mtn' | 'orange',
    data: {
      status: string;
      reason?: string;
      transactionId: string;
      financialTransactionId?: string;
      externalId?: string;
    }
  ) {
    console.log(`📝 Processing ${provider.toUpperCase()} payment callback:`, data);

    // For mock payments, use externalId to find the payment
    const paymentId = provider === 'orange' ? (data.externalId || data.transactionId) : data.transactionId;
    console.log('🔍 Looking up payment with ID:', paymentId);

    // Debug: List recent payments
    const { data: recentPayments, error: listError } = await this.supabase
      .from('payments')
      .select('id, status, transaction_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (listError) {
      console.error('❌ Error listing payments:', listError);
    } else {
      console.log('📊 Recent payments:', recentPayments);
    }

    // Try to find the payment by ID first
    const { data: paymentById, error: idError } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (idError) {
      console.error('❌ Error fetching payment by ID:', idError);
    }

    // If not found by ID, try transaction_id
    const { data: paymentByTxId, error: txError } = await this.supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', data.transactionId)
      .single();

    if (txError && txError.code !== 'PGRST116') { // Ignore "no rows" error
      console.error('❌ Error fetching payment by transaction_id:', txError);
    }

    const payment = paymentById || paymentByTxId;
    if (!payment) {
      console.error('❌ Payment not found:', { paymentId, transactionId: data.transactionId });
      throw new Error('Payment not found');
    }

    console.log('✅ Found payment:', payment);

    // Update payment status
    const { error: updateError } = await this.supabase
      .from('payments')
      .update({
        status: data.status === 'SUCCESSFUL' ? 'completed' : 'failed',
        transaction_id: data.financialTransactionId || data.transactionId,
        payment_time: new Date().toISOString(),
        metadata: {
          provider,
          reason: data.reason,
          originalTransactionId: data.transactionId
        }
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('❌ Error updating payment:', updateError);
      throw updateError;
    }

    console.log('✅ Updated payment status');

    // Send SMS notification
    try {
      await this.smsService.sendPaymentNotification(
        payment.phone_number,
        payment.amount,
        data.status === 'SUCCESSFUL'
      );
      console.log('✅ SMS notification sent');
    } catch (error) {
      console.error('❌ Error sending payment notification:', error);
      // Don't throw here - we don't want to fail the callback just because SMS failed
    }

    console.log('✅ Payment callback processed successfully');
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('status')
      .eq('id', paymentId)
      .single();

    if (error) throw error;
    return payment.status as PaymentStatus;
  }

  async getPaymentByBooking(bookingId: string): Promise<Payment | null> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (error) throw error;
    return payment;
  }

  async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    // Validation for Cameroon MTN (67) and Orange (69) numbers
    const cleanedNumber = phoneNumber.replace(/[^\d]/g, '');
    
    // Check if it's a valid length and starts with country code
    if (cleanedNumber.length !== 12 && cleanedNumber.length !== 9) {
      return false;
    }

    // Extract the actual number without country code
    const actualNumber = cleanedNumber.slice(-9);
    
    // MTN numbers start with 67
    // Orange numbers start with 69
    const validPrefixes = ['67', '69'];
    const prefix = actualNumber.slice(0, 2);
    
    return validPrefixes.includes(prefix);
  }

  getAvailableProviders() {
    return [
      {
        name: 'mtn' as const,
        displayName: 'MTN Mobile Money',
        logo: '/images/payment-providers/mtn.png',
        testNumbers: ['237670000000'],
        prefixes: ['67'],
        description: 'Fast and secure payments with MTN Mobile Money',
        minimumAmount: 100,
        maximumAmount: 500000,
        processingFee: 0,
        processingTime: '1-2 minutes'
      },
      {
        name: 'orange' as const,
        displayName: 'Orange Money',
        logo: '/images/payment-providers/orange.png',
        testNumbers: ['237699000001', '237699000002'],
        prefixes: ['69'],
        description: 'Quick and reliable payments with Orange Money',
        minimumAmount: 100,
        maximumAmount: 500000,
        processingFee: 0,
        processingTime: '1-2 minutes'
      }
    ];
  }

  private async mockPaymentProcess(request: PaymentRequest): Promise<PaymentResponse> {
    // This is a placeholder for the actual payment provider integration
    // We'll implement the real MTN and Orange Money integration here
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate successful payment 80% of the time
        const success = Math.random() > 0.2;
        resolve({
          success,
          transactionId: success ? `TRANS_${Date.now()}` : undefined,
          status: success ? 'completed' : 'failed',
          message: success ? 'Payment successful' : 'Payment failed',
          error: success ? undefined : 'Insufficient funds'
        });
      }, 2000); // Simulate network delay
    });
  }

  private async mockCheckStatus(transactionId: string): Promise<PaymentStatus> {
    // This is a placeholder for the actual payment status check
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate successful payment status 80% of the time
        const success = Math.random() > 0.2;
        resolve(success ? 'completed' : 'failed');
      }, 2000); // Simulate network delay
    });
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Format phone number to remove any '+' symbol and ensure it starts with 237
    const formattedPhone = phoneNumber.replace(/[^\d]/g, '');
    return formattedPhone.startsWith('237') ? formattedPhone : `237${formattedPhone}`;
  }

  private async createReceipt(paymentId: string) {
    try {
      const { data: receipt, error } = await this.supabase
        .rpc('create_receipt', { payment_id_param: paymentId })
        .select()
        .single();

      if (error) {
        console.error(' Error creating receipt:', error);
        throw error;
      }

      console.log(' Receipt created:', receipt);
      return receipt;
    } catch (error) {
      console.error(' Error in createReceipt:', error);
      throw error;
    }
  }

  private async handlePaymentStatusChange(
    payment: Payment,
    newStatus: PaymentStatus,
    message?: string
  ) {
    try {
      // Update payment record
      const { error: updateError } = await this.supabase
        .from('payments')
        .update({
          status: newStatus,
          payment_time: newStatus === 'completed' ? new Date().toISOString() : null,
          error_message: newStatus === 'failed' ? message : null
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error(' Error updating payment:', updateError);
        throw updateError;
      }

      // Send SMS notification
      if (newStatus === 'completed' || newStatus === 'failed') {
        const smsMessage = newStatus === 'completed'
          ? this.smsService.getPaymentConfirmationMessage({
              amount: payment.amount,
              provider: payment.provider,
              transactionId: payment.transactionId!,
              bookingId: payment.bookingId
            })
          : this.smsService.getPaymentFailureMessage({
              amount: payment.amount,
              provider: payment.provider,
              bookingId: payment.bookingId
            });

        await this.smsService.sendMessage({
          to: payment.phoneNumber,
          message: smsMessage
        });
      }

      // Update booking status if payment is completed
      if (newStatus === 'completed') {
        const { error: bookingError } = await this.supabase
          .from('bookings')
          .update({
            payment_status: 'completed',
            status: 'confirmed'
          })
          .eq('id', payment.bookingId);

        if (bookingError) {
          console.error(' Error updating booking:', bookingError);
          throw bookingError;
        }
      } else if (newStatus === 'failed') {
        const { error: bookingError } = await this.supabase
          .from('bookings')
          .update({
            payment_status: 'failed',
            status: 'cancelled'
          })
          .eq('id', payment.bookingId);

        if (bookingError) {
          console.error(' Error updating booking:', bookingError);
          throw bookingError;
        }
      }

      console.log(' Payment and booking updated successfully');
    } catch (error) {
      console.error(' Error handling payment status change:', error);
      throw error;
    }
  }
}
