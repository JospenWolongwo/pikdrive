/**
 * Orange Money Verification Service
 * Handles payment status verification
 */

import type { CheckPaymentServiceResponse, CheckPaymentTransactionStatus } from "@/types/payment-ext";
import { ENUM_CHECK_PAYMENT_TRANSACTION_STATUS } from "@/types/payment-ext";
import { OrangeTokenService } from "./token-service";

interface VerificationConfig {
  baseUrl: string;
  tokenService: OrangeTokenService;
  apiUsername: string;
  apiPassword: string;
}

export class OrangeVerificationService {
  constructor(private readonly config: VerificationConfig) {}

  /**
   * Check payment status
   */
  async checkPayment(
    payToken: string
  ): Promise<{ statusCode: number; response: CheckPaymentServiceResponse }> {
    try {
      const token = await this.config.tokenService.getToken();
      if (!token) {
        throw new Error("Unable to generate token");
      }

      return await this.checkPaymentStatus(token, payToken);
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
   * Check payment status
   */
  private async checkPaymentStatus(
    token: string,
    payToken: string
  ): Promise<{ statusCode: number; response: CheckPaymentServiceResponse }> {
    const base64Encoded = Buffer.from(
      `${this.config.apiUsername}:${this.config.apiPassword}`
    ).toString("base64");

    try {
      const response = await fetch(
        `${this.config.baseUrl}mp/paymentstatus/${payToken}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-AUTH-TOKEN": base64Encoded,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200) {
        const data = await response.json();
        let status: CheckPaymentTransactionStatus = ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.FAILED;

        if (data.data?.status === "PENDING") {
          status = ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.PENDING;
        } else if (data.data?.status === "SUCCESSFULL") {
          status = ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.SUCCESS;
        }

        return {
          statusCode: 200,
          response: {
            success: true,
            message: data.data?.confirmtxnmessage || "Transaction verified",
            status: 200,
            transactionStatus: status,
            transactionAmount: data.data?.amount || null,
            apiResponse: data,
          },
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        statusCode: 400,
        response: {
          success: false,
          message: errorData.message || "Unknown status",
          status: 400,
          transactionStatus: ENUM_CHECK_PAYMENT_TRANSACTION_STATUS.UNKNOWN,
          transactionAmount: null,
          apiResponse: errorData,
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




