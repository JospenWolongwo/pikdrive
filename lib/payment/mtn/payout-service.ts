/**
 * MTN MOMO Payout Service (Disbursement)
 * Handles merchant-to-customer payouts
 */

import type {
  PayoutRequest,
  PaymentServiceResponse,
} from "@/types/payment-ext";
import { v4 as uuidv4 } from "uuid";
import { MTNTokenService } from "./token-service";

interface PayoutConfig {
  baseUrl: string;
  subscriptionKey: string;
  disbursementSubscriptionKey?: string;
  callbackUrl: string;
  tokenService: MTNTokenService;
}

export class MTNPayoutService {
  constructor(private readonly config: PayoutConfig) {}

  /**
   * Initiate payout transaction
   */
  async payout(
    request: PayoutRequest
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    try {
      const token = await this.config.tokenService.getDisbursementToken();
      if (!token) {
        throw new Error("Unable to generate payout token");
      }

      const balanceResult = await this.checkBalance(token);
      if (!balanceResult) {
        throw new Error("Unable to check balance");
      }

      if (balanceResult.availableBalance < request.amount) {
        return {
          statusCode: 400,
          response: {
            success: false,
            message: "Insufficient balance",
            verificationToken: null,
            apiResponse: { availableBalance: balanceResult.availableBalance },
          },
        };
      }

      const xReferenceId = uuidv4();
      const externalId = xReferenceId;

      const depositResult = await this.processTransfer(
        token,
        xReferenceId,
        externalId,
        request.amount,
        request.phoneNumber,
        request.reason
      );

      if (!depositResult) {
        throw new Error("Transfer request failed");
      }

      return {
        statusCode: 200,
        response: {
          success: true,
          message: "Payout initiated successfully",
          verificationToken: xReferenceId,
          apiResponse: depositResult,
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
   * Check account balance
   */
  private async checkBalance(token: string): Promise<{
    availableBalance: number;
  } | null> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/disbursement/v1_0/account/balance`,
        {
          method: "GET",
          headers: {
            "X-Target-Environment": "mtncameroon",
            "Ocp-Apim-Subscription-Key":
              this.config.disbursementSubscriptionKey || this.config.subscriptionKey,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error("Error checking balance:", error);
      return null;
    }
  }

  /**
   * Process transfer (disbursement)
   */
  private async processTransfer(
    token: string,
    xReferenceId: string,
    externalId: string,
    amount: number,
    phoneNumber: string,
    reason: string
  ) {
    const phoneWithCountryCode = phoneNumber.startsWith("237")
      ? phoneNumber
      : `237${phoneNumber}`;

    const data = {
      amount: amount.toString(),
      currency: "XAF",
      externalId: externalId,
      payee: {
        partyIdType: "MSISDN",
        partyId: phoneWithCountryCode,
      },
      payerMessage: reason,
      payeeNote: reason,
    };

    try {
      const response = await fetch(
        `${this.config.baseUrl}/disbursement/v1_0/transfer`,
        {
          method: "POST",
          headers: {
            "X-Reference-Id": xReferenceId,
            "X-Target-Environment": "mtncameroon",
            "Ocp-Apim-Subscription-Key":
              this.config.disbursementSubscriptionKey || this.config.subscriptionKey,
            "x-callback-url": this.config.callbackUrl,
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
      return null;
    } catch (error) {
      console.error("Transfer error:", error);
      return null;
    }
  }
}










