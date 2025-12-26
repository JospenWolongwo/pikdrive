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
import { removeCallingCode, removeAllSpecialCaracter } from "../phone-utils";
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
      console.log("💰 [PAWAPAY-PAYOUT] Initiating payout:", {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        currency: request.currency,
        reason: request.reason,
      });

      // Format phone number - ensure it has country code
      const phoneWithCountryCode = request.phoneNumber.startsWith(CountryCode.CAMEROON)
        ? request.phoneNumber
        : `${CountryCode.CAMEROON}${removeCallingCode(request.phoneNumber) || request.phoneNumber}`;

      // Generate external ID for tracking
      const externalId = uuidv4();

      // Format reason/description
      const description = removeAllSpecialCaracter(request.reason);

      // Use currency from request, default to XAF for production
      const currency =
        request.currency ||
        (this.config.environment === EnvEnum.SANDBOX ? Currency.EUR : Currency.XAF);

      // Sandbox amount override (similar to MTN implementation)
      const originalAmount = request.amount;
      const payoutAmount =
        this.config.environment === EnvEnum.SANDBOX ? SandboxConfig.DEFAULT_AMOUNT : originalAmount;
      const payoutCurrency =
        this.config.environment === EnvEnum.SANDBOX ? SandboxConfig.DEFAULT_CURRENCY : currency;

      if (this.config.environment === EnvEnum.SANDBOX) {
        console.log("🧪 [PAWAPAY-PAYOUT] Sandbox amount override:", {
          originalAmount,
          originalCurrency: request.currency,
          overrideAmount: payoutAmount,
          overrideCurrency: payoutCurrency,
        });
      }

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
   * Create payout via pawaPay API
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
      const requestBody: any = {
        amount: {
          value: data.amount.toString(),
          currency: data.currency,
        },
        customerPhoneNumber: data.customerPhoneNumber,
        callbackUrl: data.callbackUrl,
        description: data.description,
        externalId: data.externalId,
      };

      // Add customer name if provided
      if (data.customerName) {
        requestBody.customerName = data.customerName;
      }

      const payoutsUrl = `${this.config.baseUrl}${PawaPayEndpoint.PAYOUTS}`;
      
      console.log("📤 [PAWAPAY-PAYOUT] Sending payout request:", {
        url: payoutsUrl,
        amount: data.amount,
        currency: data.currency,
        phoneNumber: data.customerPhoneNumber.substring(0, 5) + "...",
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

