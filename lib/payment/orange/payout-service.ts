/**
 * Orange Money Payout Service (Cashin)
 * Handles merchant-to-customer payouts
 */

import type {
  PayoutRequest,
  PaymentServiceResponse,
} from "@/types/payment-ext";
import { randomId, removeAllSpecialCaracter } from "../phone-utils";
import { OrangeTokenService } from "./token-service";

interface PayoutConfig {
  baseUrl: string;
  tokenService: OrangeTokenService;
  apiUsername: string;
  apiPassword: string;
  pinCode: string;
  merchantNumber: string;
}

export class OrangePayoutService {
  constructor(private readonly config: PayoutConfig) {}

  /**
   * Initiate payout transaction
   */
  async payout(
    request: PayoutRequest
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    try {
      const token = await this.config.tokenService.getToken();
      if (!token) {
        throw new Error("Unable to generate payout token");
      }

      const payerTokenResult = await this.initializeCashin(token);
      if (!payerTokenResult) {
        throw new Error("Unable to initialize payout");
      }

      const payerToken = payerTokenResult.data.payToken as string;
      const orderId = randomId(15);

      const payResult = await this.processCashin(
        token,
        payerToken,
        request.phoneNumber,
        request.amount,
        request.reason,
        orderId
      );

      if (!payResult || payResult.status !== 200) {
        throw new Error("Payout request failed");
      }

      return {
        statusCode: 200,
        response: {
          success: true,
          message: "Payout initiated successfully",
          verificationToken: payerToken,
          apiResponse: payResult.data,
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
   * Initialize cashin
   */
  private async initializeCashin(token: string) {
    const base64Encoded = Buffer.from(
      `${this.config.apiUsername}:${this.config.apiPassword}`
    ).toString("base64");

    try {
      const response = await fetch(`${this.config.baseUrl}cashin/init`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-AUTH-TOKEN": base64Encoded,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 200) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error("Error initializing cashin:", error);
      return null;
    }
  }

  /**
   * Process cashin
   */
  private async processCashin(
    token: string,
    payToken: string,
    phoneNumber: string,
    amount: number,
    reason: string,
    orderId: string
  ) {
    const base64Encoded = Buffer.from(
      `${this.config.apiUsername}:${this.config.apiPassword}`
    ).toString("base64");

    const phoneWithCountryCode = phoneNumber.startsWith("237")
      ? phoneNumber
      : `237${phoneNumber}`;

    const data = {
      channelUserMsisdn: this.config.merchantNumber,
      amount: amount.toString(),
      subscriberMsisdn: phoneWithCountryCode,
      pin: this.config.pinCode,
      orderId: orderId.toString(),
      description: removeAllSpecialCaracter(reason),
      payToken: payToken.toString(),
    };

    try {
      const response = await fetch(`${this.config.baseUrl}cashin/pay`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-AUTH-TOKEN": base64Encoded,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();
      return {
        status: response.status,
        data: responseData,
      };
    } catch (error) {
      console.error("Error processing cashin:", error);
      return null;
    }
  }
}




