/**
 * MTN MOMO Payin Service (Collection)
 * Handles customer-to-merchant payments
 */

import type {
  PaymentApiRequest,
  PaymentServiceResponse,
} from "@/types/payment-ext";
import { removeAllSpecialCaracter } from "../phone-utils";
import { v4 as uuidv4 } from "uuid";
import { MTNTokenService } from "./token-service";

interface PayinConfig {
  baseUrl: string;
  subscriptionKey: string;
  callbackUrl: string;
  tokenService: MTNTokenService;
  targetEnvironment: "sandbox" | "production";
}

export class MTNPayinService {
  constructor(private readonly config: PayinConfig) {}

  /**
   * Initiate payin transaction
   */
  async payin(
    request: PaymentApiRequest,
    callbackUrlOverride?: string
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    try {
      // Phone number already includes "237" prefix from route handler
      const phoneWithCountryCode = request.phoneNumber;
      const reasonUpdated = removeAllSpecialCaracter(request.reason);

      console.log("💳 [PAYIN] Requesting collection token for payment...");
      const token = await this.config.tokenService.getCollectionToken();
      if (!token) {
        const errorMsg = "Unable to generate payin token - MTN authentication failed. Check server logs for details on credential or API errors.";
        console.error("❌ [PAYIN] Token generation failed:", {
          error: errorMsg,
          note: "Review token service logs above for specific MTN API error details",
          checkThese: [
            "MOMO_SUBSCRIPTION_KEY is valid",
            "MOMO_COLLECTION_USER_ID is valid",
            "MOMO_API_KEY is valid",
            "MTN API is accessible from your server",
            "Credentials are correct for your target environment (sandbox/production)",
          ],
        });
        throw new Error(errorMsg);
      }
      
      console.log("✅ [PAYIN] Collection token obtained successfully");

      const xReferenceId = uuidv4();
      const externalId = xReferenceId;

      // Use callbackUrl override if provided, otherwise use config
      const callbackUrl = callbackUrlOverride || this.config.callbackUrl;

      const requestResult = await this.requestToPay(
        token,
        xReferenceId,
        externalId,
        request.amount,
        phoneWithCountryCode,
        reasonUpdated,
        callbackUrl
      );

      if (!requestResult) {
        throw new Error("Payment request failed");
      }

      if ('error' in requestResult) {
        throw new Error(requestResult.error);
      }

      return {
        statusCode: 200,
        response: {
          success: true,
          message: "Payment initiated successfully",
          verificationToken: xReferenceId,
          apiResponse: requestResult,
        },
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        response: {
          success: false,
          message: error.message,
          verificationToken: null,
          apiResponse: null,
        },
      };
    }
  }

  /**
   * Request to pay (collection API)
   */
  private async requestToPay(
    token: string,
    xReferenceId: string,
    externalId: string,
    amount: number,
    phoneNumber: string,
    reason: string,
    callbackUrl?: string
  ): Promise<{ status: number; referenceId: string; externalId: string } | { error: string; status?: number } | null> {
    // Sandbox requires EUR, production uses XAF (Cameroon)
    const currency = this.config.targetEnvironment === "sandbox" ? "EUR" : "XAF";
    
    const data = {
      amount: amount,
      currency: currency,
      externalId: externalId,
      payer: {
        partyIdType: "MSISDN",
        partyId: phoneNumber,
      },
      payerMessage: reason,
      payeeNote: reason,
    };

    try {
      const response = await fetch(
        `${this.config.baseUrl}/collection/v1_0/requesttopay`,
        {
          method: "POST",
          headers: {
            "X-Reference-Id": xReferenceId,
            "X-Target-Environment": this.config.targetEnvironment === "production" ? "mtncameroon" : "sandbox",
            "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
            "x-callback-url": callbackUrl || this.config.callbackUrl,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      if (response.status === 202) {
        return {
          status: 202,
          referenceId: xReferenceId,
          externalId: externalId,
        };
      }

      // Log error details for debugging
      let errorMessage = `MTN API returned status ${response.status}`;
      try {
        const errorBody = await response.text();
        console.error("MTN API error response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          requestData: { ...data, phoneNumber: phoneNumber.substring(0, 5) + "..." } // Log partial phone for privacy
        });
        errorMessage = errorBody ? `${errorMessage}: ${errorBody}` : errorMessage;
      } catch (parseError) {
        console.error("Failed to parse MTN API error response:", parseError);
      }

      return {
        error: errorMessage,
        status: response.status,
      };
    } catch (error) {
      console.error("Request to pay network error:", error);
      return {
        error: error instanceof Error ? error.message : "Network error during payment request",
      };
    }
  }
}




