import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerPaymentService } from '@/lib/services/server/payment';
import { PaymentOrchestratorService } from '@/lib/payment/payment-orchestrator.service';
import { ServerOneSignalNotificationService } from '@/lib/services/server/notifications';
import type { Environment } from '@/types/payment-ext';
import { Environment as EnvEnum, PawaPayApiUrl, HTTP_CODE } from '@/types/payment-ext';
import { isMTNPhoneNumber, isOrangePhoneNumber } from '@/lib/payment/phone-utils';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const paymentService = new ServerPaymentService(supabase);
    
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

    // Verify booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Generate idempotency key from booking ID and user ID
    const idempotencyKey = `payment_${bookingId}_${user.id}`;

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    // Validate phone number (pass provider for provider-specific validation)
    if (!validatePhoneNumber(formattedPhone, provider)) {
      const providerName = provider === 'mtn' ? 'MTN' : provider === 'orange' ? 'Orange' : 'phone';
      return NextResponse.json(
        { success: false, error: `Invalid ${providerName} number format` },
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

    // Log pawaPay environment variables (masked for security)
    const pawapayApiToken = process.env.PAWAPAY_API_TOKEN || "";
    const pawapayBaseUrl = process.env.PAWAPAY_BASE_URL || (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION ? PawaPayApiUrl.PRODUCTION : PawaPayApiUrl.SANDBOX);
    const pawapayCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/pawapay`;
    const pawapayEnvironment = (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment;
    const usePawaPay = process.env.USE_PAWAPAY;

    // Helper to mask sensitive values
    const maskToken = (token: string): string => {
      if (!token) return "NOT_SET";
      if (token.length <= 8) return "***";
      return `${token.substring(0, 4)}***${token.substring(token.length - 4)}`;
    };

    console.log("🔍 [ENV-CHECK] pawaPay Configuration:", {
      USE_PAWAPAY: usePawaPay,
      PAWAPAY_API_TOKEN: maskToken(pawapayApiToken),
      PAWAPAY_API_TOKEN_LENGTH: pawapayApiToken.length,
      PAWAPAY_API_TOKEN_EXISTS: !!pawapayApiToken,
      PAWAPAY_BASE_URL: pawapayBaseUrl,
      PAWAPAY_ENVIRONMENT: pawapayEnvironment,
      PAWAPAY_CALLBACK_URL: pawapayCallbackUrl,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
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
        apiToken: pawapayApiToken,
        baseUrl: pawapayBaseUrl,
        callbackUrl: pawapayCallbackUrl,
        environment: pawapayEnvironment,
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

function validatePhoneNumber(phoneNumber: string, provider?: string): boolean {
  const cleanedNumber = phoneNumber.replace(/[^\d]/g, '');
  
  // Accept 9 digits (without country code) or 12 digits (with country code 237)
  if (cleanedNumber.length !== 12 && cleanedNumber.length !== 9) {
    return false;
  }

  const actualNumber = cleanedNumber.length === 12 
    ? cleanedNumber.slice(-9) // Remove country code if present
    : cleanedNumber;
  
  // When provider is specified, validate against that provider's pattern
  if (provider) {
    if (provider === 'mtn') {
      return isMTNPhoneNumber(actualNumber);
    } else if (provider === 'orange') {
      return isOrangePhoneNumber(actualNumber);
    }
  }
  
  // When pawaPay is enabled or no provider specified, accept numbers that match either MTN or Orange patterns
  return isMTNPhoneNumber(actualNumber) || isOrangePhoneNumber(actualNumber);
}
