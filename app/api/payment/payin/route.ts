import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { PayoutOrchestratorService } from "@/lib/payment/payout-orchestrator.service";
import type { PaymentApiRequest, Environment } from "@/types/payment-ext";
import { Environment as EnvEnum, PawaPayApiUrl } from "@/types/payment-ext";

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          details: sessionError?.message,
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phoneNumber, amount, reason } = body;

    if (!phoneNumber || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: phoneNumber, amount" },
        { status: 400 }
      );
    }

    // Initialize orchestrator with environment config
    const orchestrator = new PayoutOrchestratorService(
      {
        subscriptionKey: process.env.DIRECT_MOMO_APIM_SUBSCRIPTION_KEY || process.env.MOMO_SUBSCRIPTION_KEY!,
        apiKey: process.env.DIRECT_MOMO_API_KEY || process.env.MOMO_API_KEY!,
        targetEnvironment: (process.env.DIRECT_MOMO_TARGET_ENVIRONMENT || process.env.MOMO_TARGET_ENVIRONMENT || "sandbox") as "sandbox" | "production",
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
        environment: (process.env.DIRECT_OM_ENVIRONMENT || process.env.ORANGE_MONEY_ENVIRONMENT || "sandbox") as "sandbox" | "production",
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

    const payinRequest: PaymentApiRequest = {
      phoneNumber,
      amount,
      reason: reason || "Payment",
    };

    const result = await orchestrator.payin(payinRequest);

    return NextResponse.json(result.response, { status: result.statusCode });
  } catch (error: any) {
    console.error("Payin error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Payment initiation failed",
      },
      { status: 500 }
    );
  }
}













