import type { SupabaseClient } from "@supabase/supabase-js";
import { PaymentApiError, ServerPaymentInitiationService } from "./payment-initiation-service";
import { ServerPaymentService } from "./payment-service";
import { isMTNPhoneNumber, isOrangePhoneNumber } from "@/lib/payment";
import { Environment as EnvEnum, HTTP_CODE, PawaPayApiUrl } from "@/types/payment-ext";
import type { Environment } from "@/types/payment-ext";
import type { PaymentMethod } from "@/types";

type PaymentCreateParams = {
  bookingId: string;
  amount: number;
  provider: PaymentMethod;
  phoneNumber: string;
  userId: string;
  idempotencyKey?: string;
};

export class ServerPaymentCreationService {
  private paymentService: ServerPaymentService;

  constructor(private supabase: SupabaseClient) {
    this.paymentService = new ServerPaymentService(supabase);
  }

  async createPayment(params: PaymentCreateParams): Promise<{
    payment: any;
    transactionId: string | null;
  }> {
    const { bookingId, amount, provider, phoneNumber, userId, idempotencyKey } = params;

    if (!bookingId || !amount || !provider || !phoneNumber) {
      throw new PaymentApiError(
        "Missing required fields: bookingId, amount, provider, phoneNumber",
        400
      );
    }

    const { data: booking, error: bookingError } = await this.supabase
      .from("bookings")
      .select("id")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new PaymentApiError("Booking not found", 404);
    }

    // Idempotency: same key on retry => same payment record returned.
    const generatedIdempotencyKey =
      idempotencyKey || `payment_${bookingId}_${userId}_${Date.now()}`;

    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!validatePhoneNumber(formattedPhone, provider)) {
      const providerName =
        provider === "mtn" ? "MTN" : provider === "orange" ? "Orange" : "phone";
      throw new PaymentApiError(`Invalid ${providerName} number format`, 400);
    }

    const payment = await this.paymentService.createPayment({
      booking_id: bookingId,
      amount,
      provider,
      phone_number: formattedPhone,
      idempotency_key: generatedIdempotencyKey,
    });

    const pawapayApiToken = process.env.PAWAPAY_API_TOKEN || "";
    const pawapayBaseUrl =
      process.env.PAWAPAY_BASE_URL ||
      (process.env.PAWAPAY_ENVIRONMENT === EnvEnum.PRODUCTION
        ? PawaPayApiUrl.PRODUCTION
        : PawaPayApiUrl.SANDBOX);
    const pawapayCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/callbacks/pawapay`;
    const pawapayEnvironment = (process.env.PAWAPAY_ENVIRONMENT || EnvEnum.SANDBOX) as Environment;
    const usePawaPay = process.env.USE_PAWAPAY;

    const maskToken = (token: string): string => {
      if (!token) return "NOT_SET";
      if (token.length <= 8) return "***";
      return `${token.substring(0, 4)}***${token.substring(token.length - 4)}`;
    };

    console.log("ðŸ” [ENV-CHECK] pawaPay Configuration:", {
      USE_PAWAPAY: usePawaPay,
      PAWAPAY_API_TOKEN: maskToken(pawapayApiToken),
      PAWAPAY_API_TOKEN_LENGTH: pawapayApiToken.length,
      PAWAPAY_API_TOKEN_EXISTS: !!pawapayApiToken,
      PAWAPAY_BASE_URL: pawapayBaseUrl,
      PAWAPAY_ENVIRONMENT: pawapayEnvironment,
      PAWAPAY_CALLBACK_URL: pawapayCallbackUrl,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    });

    const initiationService = new ServerPaymentInitiationService();
    const orchestrator = initiationService.buildOrchestrator();

    const payinResult = await orchestrator.payin({
      phoneNumber: formattedPhone,
      amount,
      reason: `PikDrive Ride Payment - ${bookingId}`,
    });

    if (
      payinResult.statusCode !== HTTP_CODE.OK ||
      !payinResult.response.success ||
      !payinResult.response.verificationToken
    ) {
      const failureMessage =
        payinResult.response.message || "Failed to initiate payment";
      const failureTransactionId = payinResult.response.verificationToken;

      try {
        await this.paymentService.updatePaymentStatus(
          payment.id,
          "failed",
          failureTransactionId ? { transaction_id: failureTransactionId } : undefined
        );
      } catch (updateError) {
        console.error("Failed to mark payment as failed after initiation error:", updateError);
      }

      throw new Error(failureMessage);
    }

    const transactionId = payinResult.response.verificationToken;
    console.log("ðŸ”„ Payment initiated via orchestrator:", {
      transactionId,
      provider: process.env.USE_PAWAPAY === "true" ? "pawapay" : provider,
      payinResult,
    });

    if (transactionId) {
      console.log("ðŸ”„ Updating payment with transaction_id:", {
        paymentId: payment.id,
        transactionId,
      });
      const updatedPayment = await this.paymentService.updatePaymentStatus(
        payment.id,
        "processing",
        {
          transaction_id: transactionId,
        }
      );
      console.log("âœ… Payment updated successfully:", {
        paymentId: updatedPayment.id,
        transaction_id: updatedPayment.transaction_id,
      });

      const { data: verifyPayment } = await this.supabase
        .from("payments")
        .select("id, transaction_id, status")
        .eq("id", payment.id)
        .single();
      console.log("ðŸ” Verification query result:", verifyPayment);
    }

    return {
      payment,
      transactionId: transactionId || null,
    };
  }
}

function formatPhoneNumber(phoneNumber: string): string {
  const formattedPhone = phoneNumber.replace(/[^\d]/g, "");
  return formattedPhone.startsWith("237") ? formattedPhone : `237${formattedPhone}`;
}

function validatePhoneNumber(phoneNumber: string, provider?: PaymentMethod): boolean {
  const cleanedNumber = phoneNumber.replace(/[^\d]/g, "");

  if (cleanedNumber.length !== 12 && cleanedNumber.length !== 9) {
    return false;
  }

  const actualNumber =
    cleanedNumber.length === 12 ? cleanedNumber.slice(-9) : cleanedNumber;

  if (provider) {
    if (provider === "mtn") {
      return isMTNPhoneNumber(actualNumber);
    }
    if (provider === "orange") {
      return isOrangePhoneNumber(actualNumber);
    }
  }

  return isMTNPhoneNumber(actualNumber) || isOrangePhoneNumber(actualNumber);
}
