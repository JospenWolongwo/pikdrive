import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { MTNMomoService } from '@/lib/payment/mtn-momo-service';
import { OrangeMoneyService } from '@/lib/payment/orange-money-service';
import { MockOrangeMoneyService } from '@/lib/payment/mock-orange-money-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const paymentService = new ServerPaymentService(supabase);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { bookingId, amount, provider, phoneNumber } = body;

    // Validate request
    if (!bookingId || !amount || !provider || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: bookingId, amount, provider, phoneNumber' },
        { status: 400 }
      );
    }

    // Generate idempotency key from booking ID and user ID
    const idempotencyKey = `payment_${bookingId}_${user.id}`;

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Validate phone number
    if (!validatePhoneNumber(formattedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Create payment record
    const payment = await paymentService.createPayment({
      booking_id: bookingId,
      amount,
      payment_method: provider,
      phone_number: formattedPhone,
      idempotency_key: idempotencyKey,
    });

    // Initialize payment with provider
    let transactionId: string | undefined;
    
    if (provider === 'mtn') {
      const mtnService = new MTNMomoService({
        subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY!,
        apiKey: process.env.MOMO_API_KEY!,
        targetEnvironment: (process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
        callbackHost: process.env.MOMO_CALLBACK_HOST!,
        collectionPrimaryKey: process.env.MOMO_COLLECTION_PRIMARY_KEY!,
        collectionUserId: process.env.MOMO_COLLECTION_USER_ID!,
      });

      const momoResponse = await mtnService.requestToPay({
        amount,
        currency: 'XAF',
        phoneNumber: formattedPhone,
        externalId: payment.id,
        payerMessage: `Payment for booking ${bookingId}`,
        payeeNote: 'PikDrive booking payment',
        callbackUrl: `${process.env.MOMO_CALLBACK_HOST}/api/payments/callback`,
      });

      transactionId = momoResponse.transactionId;
    } else if (provider === 'orange') {
      const orangeConfig = {
        merchantId: process.env.ORANGE_MONEY_MERCHANT_ID || '',
        merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || '',
        environment: (process.env.ORANGE_MONEY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
        notificationUrl: process.env.ORANGE_MONEY_NOTIFICATION_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/orange/callback`,
        returnUrl: process.env.ORANGE_MONEY_RETURN_URL || `${process.env.NEXT_PUBLIC_APP_URL}/payments/status`,
      };

      const orangeService = !orangeConfig.merchantId || process.env.USE_MOCK_ORANGE_MONEY === 'true'
        ? new MockOrangeMoneyService(orangeConfig)
        : new OrangeMoneyService(orangeConfig);

      const orangeResponse = await orangeService.initiatePayment({
        amount,
        phoneNumber: formattedPhone,
        description: `PikDrive Ride Payment - ${bookingId}`,
        externalId: payment.id,
      });

      transactionId = orangeResponse.transactionId;
    } else {
      return NextResponse.json(
        { success: false, error: `Unsupported payment provider: ${provider}` },
        { status: 400 }
      );
    }

    // Update payment with transaction ID
    if (transactionId) {
      await paymentService.updatePaymentStatus(payment.id, 'processing', {
        transaction_id: transactionId,
      });
    }

    // Return consistent response
    return NextResponse.json({
      success: true,
      data: {
        ...payment,
        transaction_id: transactionId,
        status: 'processing',
      },
      message: 'Payment initiated successfully',
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Payment creation failed',
      },
      { status: 500 }
    );
  }
}

// Helper functions
function formatPhoneNumber(phoneNumber: string): string {
  const formattedPhone = phoneNumber.replace(/[^\d]/g, '');
  return formattedPhone.startsWith('237') ? formattedPhone : `237${formattedPhone}`;
}

function validatePhoneNumber(phoneNumber: string): boolean {
  const cleanedNumber = phoneNumber.replace(/[^\d]/g, '');
  
  if (cleanedNumber.length !== 12 && cleanedNumber.length !== 9) {
    return false;
  }

  const actualNumber = cleanedNumber.slice(-9);
  const validPrefixes = ['67', '69']; // MTN (67) and Orange (69)
  const prefix = actualNumber.slice(0, 2);

  return validPrefixes.includes(prefix);
}
