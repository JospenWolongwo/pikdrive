/**
 * MTN MOMO Verification Service
 * Handles payment status verification
 */

import type { CheckPaymentServiceResponse, CheckPaymentTransactionStatus } from "@/types/payment-ext";
import { ENUM_CHECK_PAYMENT_TRANSACTION_STATUS } from "@/types/payment-ext";
import { MTNTokenService } from "./token-service";

interface VerificationConfig {
  baseUrl: string;
  subscriptionKey: string;
  tokenService: MTNTokenService;
  targetEnvironment: "sandbox" | "production";
}

export class MTNVerificationService {
  constructor(private readonly config: VerificationConfig) {}

  /**
   * Check payment status
   */
  async checkPayment(
    payToken: string
  ): Promise<{ statusCode: number; response: CheckPaymentServiceResponse }> {
    try {
      const token = await this.config.tokenService.getCollectionToken();
      if (!token) {
        throw new Error("Unable to generate token");
      }

      return await this.verifyTransaction(token, payToken);
    } catch (error: any) {
      return {
        statusCode: 500,
        response: {
          success: false,
          message: error.message,
          status: 500,
          transactionStatus: null,
          transactionAmount: 0,
          apiResponse: null,
        },
      };
    }
  }

  /**
   * Verify transaction status
   */
  private async verifyTransaction(
    token: string,
    xReferenceId: string
  ): Promise<{ statusCode: number; response: CheckPaymentServiceResponse }> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/collection/v1_0/requesttopay/${xReferenceId}`,
        {
          method: "GET",
          headers: {
            "X-Target-Environment": this.config.targetEnvironment === "production" ? "mtncameroon" : "sandbox",
            "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        const data = await response.json();
        let statusValue: CheckPaymentTransactionStatus = ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.FAILED;

        if (data.status === "PENDING") {
          statusValue = ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.PENDING;
        } else if (data.status === "SUCCESSFUL") {
          statusValue = ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.SUCCESS;
        }

        return {
          statusCode: 200,
          response: {
            success: true,
            message: "Transaction verified",
            status: 200,
            transactionStatus: statusValue,
            transactionAmount: data.amount,
            apiResponse: data,
          },
        };
      }

      // Improve error logging to get better error messages
      let errorMessage = "Unknown status";
      let errorResponse: any = null;
      try {
        const errorBody = await response.json();
        errorResponse = errorBody;
        errorMessage = errorBody?.message || errorBody?.code || JSON.stringify(errorBody);
        console.error("❌ MTN Verification API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorBody,
          xReferenceId,
          targetEnvironment: this.config.targetEnvironment,
        });
      } catch {
        const errorText = await response.text();
        errorResponse = errorText;
        errorMessage = errorText || `HTTP ${response.status}`;
        console.error("❌ MTN Verification API error (non-JSON):", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          xReferenceId,
          targetEnvironment: this.config.targetEnvironment,
        });
      }

      return {
        statusCode: response.status,
        response: {
          success: false,
          message: errorMessage,
          status: response.status,
          transactionStatus: ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.UNKNOWN,
          transactionAmount: null,
          apiResponse: errorResponse,
        },
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        response: {
          success: false,
          message: error.message,
          status: 500,
          transactionStatus: ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.UNKNOWN,
          transactionAmount: null,
          apiResponse: null,
        },
      };
    }
  }
}




