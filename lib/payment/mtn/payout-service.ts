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
  targetEnvironment: "sandbox" | "production";
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
      console.log("💰 [PAYOUT-SERVICE] Initiating payout:", {
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        currency: request.currency,
        reason: request.reason,
      });
      
      console.log("🔐 [PAYOUT-SERVICE] Requesting disbursement token...");
      const token = await this.config.tokenService.getDisbursementToken();
      
      if (!token) {
        console.error("❌ [PAYOUT-SERVICE] Token generation returned null - check token service logs above for details");
        throw new Error("Unable to generate payout token - check server logs for credential or API errors");
      }
      
      console.log("✅ [PAYOUT-SERVICE] Token received, proceeding with balance check");

      const balanceResult = await this.checkBalance(token);
      if (!balanceResult) {
        throw new Error("Unable to check balance");
      }

      // Sandbox amount override: Always use 2 EUR in sandbox to preserve balance for testing
      // Production uses actual calculated amount
      const originalAmount = request.amount;
      const payoutAmount = this.config.targetEnvironment === "sandbox" ? 2 : originalAmount;
      const currency = this.config.targetEnvironment === "sandbox" ? "EUR" : "XAF";

      if (this.config.targetEnvironment === "sandbox") {
        console.log("🧪 [PAYOUT-SERVICE] Sandbox amount override active:", {
          originalAmount,
          originalCurrency: request.currency,
          overrideAmount: payoutAmount,
          overrideCurrency: currency,
          note: "Using 2 EUR in sandbox to preserve balance for testing",
        });
      }

      // Parse balance as number (comes as string from API)
      const availableBalance = typeof balanceResult.availableBalance === 'string' 
        ? parseFloat(balanceResult.availableBalance) 
        : balanceResult.availableBalance;

      if (availableBalance < payoutAmount) {
        console.error("❌ [PAYOUT-SERVICE] Insufficient balance:", {
          availableBalance,
          requestedAmount: payoutAmount,
          currency,
          originalAmount: this.config.targetEnvironment === "sandbox" ? originalAmount : undefined,
        });
        return {
          statusCode: 400,
          response: {
            success: false,
            message: "Insufficient balance",
            verificationToken: null,
            apiResponse: { availableBalance, currency: balanceResult.currency },
          },
        };
      }

      console.log("✅ [PAYOUT-SERVICE] Balance check passed:", {
        availableBalance,
        payoutAmount,
        currency,
        remainingBalance: availableBalance - payoutAmount,
      });

      const xReferenceId = uuidv4();
      const externalId = xReferenceId;

      const depositResult = await this.processTransfer(
        token,
        xReferenceId,
        externalId,
        payoutAmount,
        request.phoneNumber,
        request.reason,
        currency
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
    availableBalance: number | string;
    currency?: string;
    accountStatus?: string;
  } | null> {
    const balanceUrl = `${this.config.baseUrl}/disbursement/v1_0/account/balance`;
    const subscriptionKey = this.config.disbursementSubscriptionKey || this.config.subscriptionKey;

    // Target environment must match base URL environment:
    // - Sandbox base URL (sandbox.momodeveloper.mtn.com) → "sandbox"
    // - Production base URL (api.mtn.cm) → "mtncameroon"
    const balanceTargetEnv = this.config.targetEnvironment === "production" ? "mtncameroon" : "sandbox";
    
    console.log("💰 [BALANCE] Checking disbursement account balance:", {
      url: balanceUrl,
      baseUrl: this.config.baseUrl,
      hasToken: !!token,
      tokenPrefix: token ? `${token.substring(0, 10)}...` : null,
      hasSubscriptionKey: !!subscriptionKey,
      hasDisbursementSubscriptionKey: !!this.config.disbursementSubscriptionKey,
      targetEnvironment: balanceTargetEnv,
      configTargetEnvironment: this.config.targetEnvironment,
      note: "Target environment matches base URL environment",
    });

    try {
      const response = await fetch(balanceUrl, {
        method: "GET",
        headers: {
          "X-Target-Environment": balanceTargetEnv,
          "Ocp-Apim-Subscription-Key": subscriptionKey,
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        const balanceData = await response.json();
        console.log("✅ [BALANCE] Balance check successful:", {
          availableBalance: balanceData.availableBalance,
          currency: balanceData.currency,
          accountStatus: balanceData.accountStatus,
          targetEnvironment: this.config.targetEnvironment,
          note: this.config.targetEnvironment === "sandbox" 
            ? "Sandbox uses EUR. Payouts will be overridden to 2 EUR for testing."
            : "Production uses XAF. Payouts use actual calculated amounts.",
        });
        return balanceData;
      }

      // Enhanced error logging for non-200 responses
      let errorBody: any = null;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          errorBody = await response.json();
        } else {
          errorBody = await response.text();
        }
      } catch (parseError) {
        console.warn("⚠️ [BALANCE] Could not parse error response body:", parseError);
      }

      console.error("❌ [BALANCE] Failed to check balance:", {
        status: response.status,
        statusText: response.statusText,
        url: balanceUrl,
        headers: {
          contentType: response.headers.get("content-type"),
          subscriptionKeyUsed: !!subscriptionKey,
          hasDisbursementSubscriptionKey: !!this.config.disbursementSubscriptionKey,
        },
        errorBody: errorBody,
        requestDetails: {
          method: "GET",
          baseUrl: this.config.baseUrl,
          targetEnvironment: balanceTargetEnv,
          configTargetEnvironment: this.config.targetEnvironment,
          hasToken: !!token,
        },
      });

      return null;
    } catch (error) {
      console.error("❌ [BALANCE] Exception checking balance:", {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error,
        url: balanceUrl,
        baseUrl: this.config.baseUrl,
        hasCredentials: {
          token: !!token,
          subscriptionKey: !!subscriptionKey,
          disbursementSubscriptionKey: !!this.config.disbursementSubscriptionKey,
        },
      });
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
    reason: string,
    currency: string
  ) {
    const phoneWithCountryCode = phoneNumber.startsWith("237")
      ? phoneNumber
      : `237${phoneNumber}`;

    console.log("💸 [TRANSFER] Processing disbursement transfer:", {
      amount,
      currency,
      phoneNumber: phoneWithCountryCode,
      xReferenceId,
      targetEnvironment: this.config.targetEnvironment,
    });

    const data = {
      amount: amount.toString(),
      currency: currency,
      externalId: externalId,
      payee: {
        partyIdType: "MSISDN",
        partyId: phoneWithCountryCode,
      },
      payerMessage: reason,
      payeeNote: reason,
    };

    try {
      const targetEnv = this.config.targetEnvironment === "production" ? "mtncameroon" : "sandbox";
      const response = await fetch(
        `${this.config.baseUrl}/disbursement/v1_0/transfer`,
        {
          method: "POST",
          headers: {
            "X-Reference-Id": xReferenceId,
            "X-Target-Environment": targetEnv,
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










