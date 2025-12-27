import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { PaymentOrchestratorService } from '@/lib/payment/payment-orchestrator.service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';
import { ServerOneSignalNotificationService } from '@/lib/services/server/onesignal-notification-service';
import type { Environment } from '@/types/payment-ext';
import { Environment as EnvEnum, PawaPayApiUrl, HTTP_CODE } from '@/types/payment-ext';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const paymentService = new ServerPaymentService(supabase);
    const notificationService = new ServerOneSignalNotificationService(supabase);
    
    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const user = session.user;

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
      provider, // Column name is 'provider', not 'payment_method'
      phone_number: formattedPhone,
      idempotency_key: idempotencyKey,
    });

    // Initialize orchestrator - this will route to pawaPay if USE_PAWAPAY=true
    // Otherwise routes to MTN/Orange based on phone number
    const orchestrator = new PaymentOrchestratorService(
      {
        subscriptionKey: process.env.DIRECT_MOMO_APIM_SUBSCRIPTION_KEY || process.env.MOMO_SUBSCRIPTION_KEY!,
        apiKey: process.env.DIRECT_MOMO_API_KEY || process.env.MOMO_API_KEY!,
        targetEnvironment: (process.env.DIRECT_MOMO_TARGET_ENVIRONMENT || process.env.MOMO_TARGET_ENVIRONMENT || EnvEnum.SANDBOX) as Environment,
        callbackHost: process.env.DIRECT_MOMO_CALLBACK_HOST || process.env.MOMO_CALLBACK_HOST || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        collectionPrimaryKey: process.env.DIRECT_MOMO_COLLECTION_PRIMARY_KEY || process.env.MOMO_COLLECTION_PRIMARY_KEY!,
        collectionUserId: process.env.DIRECT_MOMO_API_USER || process.env.MOMO_COLLECTION_USER_ID!,
        disbursementApiUser: process.env.DIRECT_MOMO_API_USER_DISBURSMENT,
        disbursementApiKey: process.env.DIRECT_MOMO_API_KEY_DISBURSMENT,
        disbursementSubscriptionKey: process.env.DIRECT_MOMO_APIM_PAY_OUT_SUBSCRIPTION_KEY,
      },
      {
        merchantId: process.env.DIRECT_OM_MERCHAND_NUMBER || process.env.ORANGE_MONEY_MERCHANT_ID || "",
        merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY || "",
        environment: (process.env.DIRECT_OM_ENVIRONMENT || process.env.ORANGE_MONEY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment,
        notificationUrl: process.env.DIRECT_OM_CALLBACK_URL || process.env.ORANGE_MONEY_NOTIFICATION_URL || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/om`,
        returnUrl: process.env.ORANGE_MONEY_RETURN_URL || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payments/status`,
        consumerUser: process.env.DIRECT_OM_CONSUMER_USER,
        consumerSecret: process.env.DIRECT_OM_CONSUMER_SECRET,
        apiUsername: process.env.DIRECT_OM_API_USERNAME,
        apiPassword: process.env.DIRECT_OM_API_PASSWORD,
        pinCode: process.env.DIRECT_OM_PIN_CODE,
        merchantNumber: process.env.DIRECT_OM_MERCHAND_NUMBER,
        tokenUrl: process.env.DIRECT_OM_TOKEN_URL,
        baseUrl: process.env.DIRECT_OM_BASE_URL,
      },
      {
        apiToken: process.env.PAWAPAY_API_TOKEN || "",
        baseUrl: process.env.PAWAPAY_BASE_URL || (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION ? PawaPayApiUrl.PRODUCTION : PawaPayApiUrl.SANDBOX),
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/pawapay`,
        environment: (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment,
      }
    );

    // Use orchestrator to initiate payment
    // The orchestrator will route to pawaPay if USE_PAWAPAY=true, otherwise route based on phone number
    const payinResult = await orchestrator.payin({
        phoneNumber: formattedPhone,
        amount,
        reason: `PikDrive Ride Payment - ${bookingId}`,
      });

      // Check if payment was initiated successfully
    if (payinResult.statusCode !== HTTP_CODE.OK || !payinResult.response.success || !payinResult.response.verificationToken) {
        throw new Error(
        payinResult.response.message || "Failed to initiate payment"
      );
    }

    const transactionId = payinResult.response.verificationToken;
    console.log('🔄 Payment initiated via orchestrator:', { 
      transactionId, 
      provider: process.env.USE_PAWAPAY === 'true' ? 'pawapay' : provider,
      payinResult 
    });

    // Update payment with transaction ID
    if (transactionId) {
      console.log('🔄 Updating payment with transaction_id:', { paymentId: payment.id, transactionId });
      const updatedPayment = await paymentService.updatePaymentStatus(payment.id, 'processing', {
        transaction_id: transactionId,
      });
      console.log('✅ Payment updated successfully:', { paymentId: updatedPayment.id, transaction_id: updatedPayment.transaction_id });
      
      // Verify the update worked by querying the database directly
      const { data: verifyPayment } = await supabase
        .from('payments')
        .select('id, transaction_id, status')
        .eq('id', payment.id)
        .single();
      console.log('🔍 Verification query result:', verifyPayment);

      // ❌ REMOVED: Immediate "processing" notification
      // Notifications will be sent ONLY after payment completes via polling
      // This prevents sending premature "en cours de traitement" notifications
      // The payment status checker will handle notifications on completion
    }

    // Return consistent response
    console.log('🎯 Payment creation complete - returning response:', {
      paymentId: payment.id,
      transactionId: transactionId,
      bookingId: payment.booking_id,
    });

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
  
  // Accept 9 digits (without country code) or 12 digits (with country code 237)
  if (cleanedNumber.length !== 12 && cleanedNumber.length !== 9) {
    return false;
  }

  const actualNumber = cleanedNumber.length === 12 
    ? cleanedNumber.slice(-9) // Remove country code if present
    : cleanedNumber;
  
  // MTN prefixes: 67, 68, 50-54 (6[7-8] or 6[5][0-4])
  // Orange prefixes: 69, 65-59 (6[9] or 6[5-9])
  // When pawaPay is enabled, it handles both, so we accept all valid Cameroon mobile prefixes
  const validPrefixes = ['67', '68', '69', '65', '66']; // Common MTN and Orange prefixes
  const prefix = actualNumber.slice(0, 2);

  return validPrefixes.includes(prefix) || 
         (actualNumber.startsWith('6') && actualNumber.length === 9); // Accept any 6XX prefix for flexibility
}
