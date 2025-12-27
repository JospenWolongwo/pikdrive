/**
 * pawaPay Payout Service
 * Handles merchant-to-customer payouts via pawaPay aggregator
 */

import type {
  PayoutRequest,
  PaymentServiceResponse,
  Environment,
} from "@/types/payment-ext";
import {
  Currency,
  Environment as EnvEnum,
  PawaPayEndpoint,
  HttpMethod,
  HttpHeader,
  ContentType,
  AuthScheme,
  CountryCode,
  PawaPayStatus,
  HTTP_CODE,
  SandboxConfig,
} from "@/types/payment-ext";
import { removeCallingCode, removeAllSpecialCaracter, isMTNPhoneNumber, isOrangePhoneNumber } from "../phone-utils";
import { v4 as uuidv4 } from "uuid";

interface PayoutConfig {
  readonly baseUrl: string;
  readonly apiToken: string;
  readonly callbackUrl: string;
  readonly environment: Environment;
}

export class PawaPayPayoutService {
  constructor(private readonly config: PayoutConfig) {}

  /**
   * Initiate payout transaction
   */
  async payout(
    request: PayoutRequest
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    try {
      // Sandbox test number override (for automatic payout testing)
      // Sandbox test numbers for payout testing:
      // - 237653456789 - Returns COMPLETED status
      // - 237653456129 - Returns SUBMITTED status
      let payoutPhoneNumber = request.phoneNumber;
      if (this.config.environment === EnvEnum.SANDBOX) {
        const sandboxTestPhone = process.env.SANDBOX_PAWAPAY_TEST_PHONE;
        if (sandboxTestPhone) {
          const originalPhone = request.phoneNumber;
          payoutPhoneNumber = sandboxTestPhone;
          console.log("🧪 [PAWAPAY-PAYOUT] Sandbox test number override active:", {
            originalPhone,
            testPhone: sandboxTestPhone,
            note: "Using pawaPay sandbox test number for automatic payout testing",
          });
        }
      }

      console.log("💰 [PAWAPAY-PAYOUT] Initiating payout:", {
        phoneNumber: payoutPhoneNumber,
        amount: request.amount,
        currency: request.currency,
        reason: request.reason,
      });

      // Format phone number - ensure it has country code
      const phoneWithCountryCode = payoutPhoneNumber.startsWith(CountryCode.CAMEROON)
        ? payoutPhoneNumber
        : `${CountryCode.CAMEROON}${removeCallingCode(payoutPhoneNumber) || payoutPhoneNumber}`;

      // Generate external ID for tracking
      const externalId = uuidv4();

      // Format reason/description
      const description = removeAllSpecialCaracter(request.reason);

      // Always use XAF for Cameroon (both sandbox and production)
      // Sandbox mirrors production - same currencies and formatting rules
      const currency = request.currency || Currency.XAF;

      // Note: Sandbox test numbers for payout testing:
      // - 237653456789 - Returns COMPLETED status
      // - 237653456129 - Returns SUBMITTED status
      const payoutAmount = request.amount;
      const payoutCurrency = currency;

      const payoutResult = await this.createPayout({
        amount: payoutAmount,
        currency: payoutCurrency,
        customerPhoneNumber: phoneWithCountryCode,
        callbackUrl: this.config.callbackUrl,
        description,
        externalId,
        customerName: request.customerName,
      });

      if (!payoutResult) {
        throw new Error("Payout request failed");
      }

      if ("error" in payoutResult) {
        throw new Error(payoutResult.error);
      }

      // pawaPay returns payoutId in the response
      const payoutId = payoutResult.payoutId || externalId;

      return {
        statusCode: HTTP_CODE.OK,
        response: {
          success: true,
          message: "Payout initiated successfully",
          verificationToken: payoutId,
          apiResponse: payoutResult,
        },
      };
    } catch (error: any) {
      console.error("❌ [PAWAPAY-PAYOUT] Error:", error);
      return {
        statusCode: HTTP_CODE.INTERNAL_SERVER_ERROR,
        response: {
          success: false,
          message: error.message || "Payout initiation failed",
          verificationToken: null,
          apiResponse: null,
        },
      };
    }
  }

  /**
   * Create payout via pawaPay API v2
   */
  private async createPayout(data: {
    amount: number;
    currency: string;
    customerPhoneNumber: string;
    callbackUrl: string;
    description: string;
    externalId: string;
    customerName?: string;
  }): Promise<
    | { payoutId: string; status: string; [key: string]: any }
    | { error: string; status?: number }
    | null
  > {
    try {
      // Format amount for XAF - no decimal places (pawaPay requirement for XAF)
      // XAF does not support decimal places - send as integer string
      const formattedAmount = Math.floor(data.amount).toString();

      // Determine provider based on phone number
      // pawaPay provider codes for Cameroon: MTN_MOMO_CMR, ORANGE_CMR
      let provider: string;
      if (isMTNPhoneNumber(data.customerPhoneNumber)) {
        provider = "MTN_MOMO_CMR"; // MTN Mobile Money Cameroon
      } else if (isOrangePhoneNumber(data.customerPhoneNumber)) {
        provider = "ORANGE_CMR"; // Orange Money Cameroon
      } else {
        // Default to MTN if cannot determine (pawaPay will handle validation)
        provider = "MTN_MOMO_CMR";
        console.warn("⚠️ [PAWAPAY-PAYOUT] Could not determine provider, defaulting to MTN_MOMO_CMR");
      }

      // Generate payoutId (UUID) for v2 API
      const payoutId = uuidv4();

      // pawaPay API v2 format
      // Note: callbackUrl is configured in pawaPay dashboard, not sent in request body
      const requestBody: any = {
        payoutId: payoutId,
        recipient: {
          type: "MMO", // Required by pawaPay API v2 - Mobile Money Operator
          accountDetails: {
            phoneNumber: data.customerPhoneNumber,
            provider: provider, // MTN_MOMO_CMR or ORANGE_CMR
          },
        },
        amount: formattedAmount, // Formatted string without decimals for XAF: "4000"
        currency: data.currency,
        clientReferenceId: data.externalId,
        correspondent: provider, // The provider/correspondent to use
        statementDescription: data.description.substring(0, 22), // Max 22 chars
      };

      // Add customer name if provided
      if (data.customerName) {
        requestBody.recipient.name = data.customerName;
      }

      const payoutsUrl = `${this.config.baseUrl}${PawaPayEndpoint.PAYOUTS}`;

      console.log("📤 [PAWAPAY-PAYOUT] Sending payout request (v2 format):", {
        url: payoutsUrl,
        payoutId: payoutId,
        originalAmount: data.amount,
        formattedAmount: formattedAmount,
        currency: data.currency,
        phoneNumber: data.customerPhoneNumber.substring(0, 5) + "...",
        provider: provider,
        clientReferenceId: data.externalId,
        requestBody: {
          ...requestBody,
          recipient: {
            ...requestBody.recipient,
            accountDetails: {
              phoneNumber: requestBody.recipient.accountDetails.phoneNumber.substring(0, 5) + "...",
              provider: requestBody.recipient.accountDetails.provider,
            },
          },
        },
      });

      const response = await fetch(payoutsUrl, {
        method: HttpMethod.POST,
        headers: {
          [HttpHeader.AUTHORIZATION]: `${AuthScheme.BEARER} ${this.config.apiToken}`,
          [HttpHeader.CONTENT_TYPE]: ContentType.JSON,
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json().catch(async () => {
        const text = await response.text();
        return { error: text || `HTTP ${response.status}` };
      });

      if (response.ok) {
        console.log("✅ [PAWAPAY-PAYOUT] Payout created successfully:", {
          payoutId: responseData.payoutId || responseData.id,
          status: responseData.status,
        });
        return {
          payoutId: responseData.payoutId || responseData.id,
          status: responseData.status || PawaPayStatus.ACCEPTED,
          ...responseData,
        };
      }

      // Handle error response
      const errorMessage =
        responseData.message ||
        responseData.error ||
        `pawaPay API returned status ${response.status}`;

      console.error("❌ [PAWAPAY-PAYOUT] Payout creation failed:", {
        status: response.status,
        error: errorMessage,
        responseData,
      });

      return {
        error: errorMessage,
        status: response.status,
      };
    } catch (error) {
      console.error("❌ [PAWAPAY-PAYOUT] Network error:", error);
      return {
        error:
          error instanceof Error
            ? error.message
            : "Network error during payout request",
      };
    }
  }
}

