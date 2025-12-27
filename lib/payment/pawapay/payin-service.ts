/**
 * pawaPay Payin Service (Deposits)
 * Handles customer-to-merchant payments via pawaPay aggregator
 */

import type {
  PaymentApiRequest,
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
} from "@/types/payment-ext";
import { removeCallingCode, removeAllSpecialCaracter } from "../phone-utils";
import { v4 as uuidv4 } from "uuid";

interface PayinConfig {
  readonly baseUrl: string;
  readonly apiToken: string;
  readonly callbackUrl: string;
  readonly environment: Environment;
}

export class PawaPayPayinService {
  constructor(private readonly config: PayinConfig) {}

  /**
   * Initiate payin transaction (deposit)
   */
  async payin(
    request: PaymentApiRequest
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    try {
      console.log("💳 [PAWAPAY-PAYIN] Initiating deposit:", {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
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

      // Determine currency based on environment
      const currency = this.config.environment === EnvEnum.SANDBOX ? Currency.EUR : Currency.XAF;

      const depositResult = await this.createDeposit({
        amount: request.amount,
        currency,
        customerPhoneNumber: phoneWithCountryCode,
        callbackUrl: this.config.callbackUrl,
        description,
        externalId,
      });

      if (!depositResult) {
        throw new Error("Deposit request failed");
      }

      if ("error" in depositResult) {
        throw new Error(depositResult.error);
      }

      // pawaPay returns depositId in the response
      const depositId = depositResult.depositId || externalId;

      return {
        statusCode: HTTP_CODE.OK,
        response: {
          success: true,
          message: "Payment initiated successfully",
          verificationToken: depositId,
          apiResponse: depositResult,
        },
      };
    } catch (error: any) {
      console.error("❌ [PAWAPAY-PAYIN] Error:", error);
      return {
        statusCode: HTTP_CODE.INTERNAL_SERVER_ERROR,
        response: {
          success: false,
          message: error.message || "Payment initiation failed",
          verificationToken: null,
          apiResponse: null,
        },
      };
    }
  }

  /**
   * Create deposit via pawaPay API
   */
  private async createDeposit(data: {
    amount: number;
    currency: string;
    customerPhoneNumber: string;
    callbackUrl: string;
    description: string;
    externalId: string;
  }): Promise<
    | { depositId: string; status: string; [key: string]: any }
    | { error: string; status?: number }
    | null
  > {
    try {
      const requestBody = {
        amount: {
          value: data.amount.toString(),
          currency: data.currency,
        },
        customerPhoneNumber: data.customerPhoneNumber,
        callbackUrl: data.callbackUrl,
        description: data.description,
        externalId: data.externalId,
      };

      const depositsUrl = `${this.config.baseUrl}${PawaPayEndpoint.DEPOSITS}`;
      
      // Helper to mask sensitive values
      const maskToken = (token: string): string => {
        if (!token) return "NOT_SET";
        if (token.length <= 8) return "***";
        return `${token.substring(0, 4)}***${token.substring(token.length - 4)}`;
      };

      const authHeader = `${AuthScheme.BEARER} ${this.config.apiToken}`;
      
      // Debug: Check for whitespace issues
      const cleanToken = this.config.apiToken.trim();
      const tokenHasWhitespace = this.config.apiToken !== cleanToken;
      
      console.log("📤 [PAWAPAY-PAYIN] Sending deposit request:", {
        url: depositsUrl,
        amount: data.amount,
        currency: data.currency,
        phoneNumber: data.customerPhoneNumber.substring(0, 5) + "...",
        apiToken: maskToken(this.config.apiToken),
        apiTokenLength: this.config.apiToken.length,
        apiTokenExists: !!this.config.apiToken,
        authHeader: maskToken(authHeader),
        baseUrl: this.config.baseUrl,
        environment: this.config.environment,
      });

      // Detailed debug logging for Authorization header
      console.log("🔍 [PAWAPAY-DEBUG] Exact Authorization Header Analysis:", {
        headerValue: authHeader,
        headerLength: authHeader.length,
        startsWithBearer: authHeader.startsWith('Bearer '),
        bearerPrefix: AuthScheme.BEARER,
        tokenStartsWith: this.config.apiToken.substring(0, 10),
        tokenEndsWith: this.config.apiToken.substring(this.config.apiToken.length - 10),
        tokenHasWhitespace: tokenHasWhitespace,
        tokenHasNewlines: this.config.apiToken.includes('\n') || this.config.apiToken.includes('\r'),
        originalTokenLength: this.config.apiToken.length,
        trimmedTokenLength: cleanToken.length,
        firstCharCode: this.config.apiToken.charCodeAt(0),
        lastCharCode: this.config.apiToken.charCodeAt(this.config.apiToken.length - 1),
      });

      const response = await fetch(depositsUrl, {
        method: HttpMethod.POST,
        headers: {
          [HttpHeader.AUTHORIZATION]: authHeader,
          [HttpHeader.CONTENT_TYPE]: ContentType.JSON,
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json().catch(async () => {
        const text = await response.text();
        return { error: text || `HTTP ${response.status}` };
      });

      if (response.ok) {
        console.log("✅ [PAWAPAY-PAYIN] Deposit created successfully:", {
          depositId: responseData.depositId || responseData.id,
          status: responseData.status,
        });
        return {
          depositId: responseData.depositId || responseData.id,
          status: responseData.status || PawaPayStatus.ACCEPTED,
          ...responseData,
        };
      }

      // Handle error response
      const errorMessage =
        responseData.message ||
        responseData.error ||
        `pawaPay API returned status ${response.status}`;

      console.error("❌ [PAWAPAY-PAYIN] Deposit creation failed:", {
        status: response.status,
        error: errorMessage,
        responseData,
      });

      return {
        error: errorMessage,
        status: response.status,
      };
    } catch (error) {
      console.error("❌ [PAWAPAY-PAYIN] Network error:", error);
      return {
        error:
          error instanceof Error
            ? error.message
            : "Network error during deposit request",
      };
    }
  }
}

