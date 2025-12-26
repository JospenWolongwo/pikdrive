/**
 * pawaPay Verification Service
 * Handles payment status verification via polling (SECONDARY mechanism)
 * Used for reconciliation and fallback when webhooks are missed
 */

import type { CheckPaymentServiceResponse, Environment } from "@/types/payment-ext";
import {
  ENUM_CHECK_PAYMENT_TRANSACTION_STATUS,
  PawaPayEndpoint,
  HttpMethod,
  HttpHeader,
  ContentType,
  AuthScheme,
  PawaPayStatus,
  HTTP_CODE,
} from "@/types/payment-ext";

interface VerificationConfig {
  readonly baseUrl: string;
  readonly apiToken: string;
  readonly environment: Environment;
}

export class PawaPayVerificationService {
  constructor(private readonly config: VerificationConfig) {}

  /**
   * Check payment status (deposit)
   */
  async checkPayment(
    depositId: string
  ): Promise<{ statusCode: number; response: CheckPaymentServiceResponse }> {
    try {
      console.log("🔍 [PAWAPAY-VERIFY] Checking deposit status:", {
        depositId,
      });

      const statusResult = await this.getDepositStatus(depositId);

      if (!statusResult) {
        return {
          statusCode: HTTP_CODE.NOT_FOUND,
          response: {
            success: false,
            message: "Deposit not found",
            status: HTTP_CODE.NOT_FOUND,
            transactionStatus: null,
            transactionAmount: null,
            apiResponse: null,
          },
        };
      }

      if ("error" in statusResult) {
        return {
          statusCode: statusResult.status || HTTP_CODE.INTERNAL_SERVER_ERROR,
          response: {
            success: false,
            message: statusResult.error,
            status: statusResult.status || HTTP_CODE.INTERNAL_SERVER_ERROR,
            transactionStatus: null,
            transactionAmount: null,
            apiResponse: null,
          },
        };
      }

      // Map pawaPay status to internal status
      const transactionStatus = this.mapPawaPayStatusToInternal(
        statusResult.status
      );

      const amount = statusResult.amount?.value
        ? parseFloat(statusResult.amount.value)
        : null;

      return {
        statusCode: HTTP_CODE.OK,
        response: {
          success: true,
          message: "Transaction verified",
          status: HTTP_CODE.OK,
          transactionStatus,
          transactionAmount: amount,
          apiResponse: statusResult,
        },
      };
    } catch (error: any) {
      console.error("❌ [PAWAPAY-VERIFY] Error checking deposit:", error);
      return {
        statusCode: HTTP_CODE.INTERNAL_SERVER_ERROR,
        response: {
          success: false,
          message: error.message || "Status check failed",
          status: HTTP_CODE.INTERNAL_SERVER_ERROR,
          transactionStatus: null,
          transactionAmount: null,
          apiResponse: null,
        },
      };
    }
  }

  /**
   * Check payout status
   */
  async checkPayoutStatus(
    payoutId: string
  ): Promise<{
    status: string;
    amount?: string;
    currency?: string;
    transactionId?: string;
    reason?: string;
  } | null> {
    try {
      console.log("🔍 [PAWAPAY-VERIFY] Checking payout status:", {
        payoutId,
      });

      const statusResult = await this.getPayoutStatus(payoutId);

      if (!statusResult || "error" in statusResult) {
        return null;
      }

      return {
        status: statusResult.status || PawaPayStatus.UNKNOWN,
        amount: statusResult.amount?.value,
        currency: statusResult.amount?.currency,
        transactionId: statusResult.transactionId || payoutId,
        reason: statusResult.failureReason || statusResult.reason,
      };
    } catch (error) {
      console.error("❌ [PAWAPAY-VERIFY] Error checking payout:", error);
      return null;
    }
  }

  /**
   * Get deposit status from pawaPay API
   */
  private async getDepositStatus(
    depositId: string
  ): Promise<
    | {
        depositId: string;
        status: string;
        amount?: { value: string; currency: string };
        [key: string]: any;
      }
    | { error: string; status?: number }
    | null
  > {
    try {
      const depositsUrl = `${this.config.baseUrl}${PawaPayEndpoint.DEPOSITS}/${depositId}`;
      
      const response = await fetch(depositsUrl, {
        method: HttpMethod.GET,
        headers: {
          [HttpHeader.AUTHORIZATION]: `${AuthScheme.BEARER} ${this.config.apiToken}`,
          [HttpHeader.CONTENT_TYPE]: ContentType.JSON,
        },
      });

      if (response.status === HTTP_CODE.NOT_FOUND) {
        return null;
      }

      const responseData = await response.json().catch(async () => {
        const text = await response.text();
        return { error: text || `HTTP ${response.status}` };
      });

      if (response.ok) {
        return responseData;
      }

      return {
        error:
          responseData.message ||
          responseData.error ||
          `HTTP ${response.status}`,
        status: response.status,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Network error",
      };
    }
  }

  /**
   * Get payout status from pawaPay API
   */
  private async getPayoutStatus(
    payoutId: string
  ): Promise<
    | {
        payoutId: string;
        status: string;
        amount?: { value: string; currency: string };
        transactionId?: string;
        failureReason?: string;
        reason?: string;
        [key: string]: any;
      }
    | { error: string; status?: number }
    | null
  > {
    try {
      const payoutsUrl = `${this.config.baseUrl}${PawaPayEndpoint.PAYOUTS}/${payoutId}`;
      
      const response = await fetch(payoutsUrl, {
        method: HttpMethod.GET,
        headers: {
          [HttpHeader.AUTHORIZATION]: `${AuthScheme.BEARER} ${this.config.apiToken}`,
          [HttpHeader.CONTENT_TYPE]: ContentType.JSON,
        },
      });

      if (response.status === HTTP_CODE.NOT_FOUND) {
        return null;
      }

      const responseData = await response.json().catch(async () => {
        const text = await response.text();
        return { error: text || `HTTP ${response.status}` };
      });

      if (response.ok) {
        return responseData;
      }

      return {
        error:
          responseData.message ||
          responseData.error ||
          `HTTP ${response.status}`,
        status: response.status,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Network error",
      };
    }
  }

  /**
   * Map pawaPay status to internal CheckPaymentTransactionStatus
   */
  private mapPawaPayStatusToInternal(
    status: string
  ): keyof typeof ENUM_CHECK_PAYMENT_TRANSACTION_STATUS {
    const upperStatus = status.toUpperCase() as PawaPayStatus;

    if (upperStatus === PawaPayStatus.COMPLETED || upperStatus === PawaPayStatus.SUCCESSFUL) {
      return ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.SUCCESS;
    }

    if (upperStatus === PawaPayStatus.FAILED || upperStatus === PawaPayStatus.FAILURE) {
      return ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.FAILED;
    }

    if (
      upperStatus === PawaPayStatus.ACCEPTED ||
      upperStatus === PawaPayStatus.SUBMITTED ||
      upperStatus === PawaPayStatus.PROCESSING ||
      upperStatus === PawaPayStatus.ENQUEUED
    ) {
      return ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.PENDING;
    }

    return ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.UNKNOWN;
  }
}

