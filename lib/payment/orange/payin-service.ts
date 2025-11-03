/**
 * Orange Money Payin Service (Merchand Payment)
 * Handles customer-to-merchant payments
 */

import type {
  PaymentApiRequest,
  PaymentServiceResponse,
} from "@/types/payment-ext";
import { randomId, removeAllSpecialCaracter } from "../phone-utils";
import { OrangeTokenService } from "./token-service";

interface PayinConfig {
  baseUrl: string;
  tokenService: OrangeTokenService;
  apiUsername: string;
  apiPassword: string;
  pinCode: string;
  merchantNumber: string;
  notificationUrl: string;
}

export class OrangePayinService {
  constructor(private readonly config: PayinConfig) {}

  /**
   * Initiate payin transaction
   */
  async payin(
    request: PaymentApiRequest
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    try {
      const token = await this.config.tokenService.getToken();
      if (!token) {
        throw new Error("Unable to generate payin token");
      }

      const payerTokenResult = await this.initializePayment(token);
      if (!payerTokenResult) {
        throw new Error("Unable to initialize payment");
      }

      const payerToken = payerTokenResult.data.payToken;
      const orderId = randomId(15);

      const payResult = await this.processPayment(
        token,
        payerToken,
        request.phoneNumber,
        request.amount,
        request.reason,
        orderId
      );

      if (payResult?.status === 200) {
        return {
          statusCode: 200,
          response: {
            success: true,
            message: "Payment initiated successfully",
            verificationToken: payerToken,
            apiResponse: payResult.data,
          },
        };
      }

      return {
        statusCode: 500,
        response: {
          success: false,
          message: payResult?.data?.message || "Payment failed",
          verificationToken: payerToken,
          apiResponse: payResult?.data || null,
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
   * Initialize payment
   */
  private async initializePayment(token: string) {
    const base64Encoded = Buffer.from(
      `${this.config.apiUsername}:${this.config.apiPassword}`
    ).toString("base64");

    try {
      const response = await fetch(`${this.config.baseUrl}mp/init`, {
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
      console.error("Error initializing payment:", error);
      return null;
    }
  }

  /**
   * Process payment
   */
  private async processPayment(
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
      notifUrl: this.config.notificationUrl,
      channelUserMsisdn: this.config.merchantNumber,
      amount: amount.toString(),
      subscriberMsisdn: phoneWithCountryCode,
      pin: this.config.pinCode,
      orderId: orderId.toString(),
      description: removeAllSpecialCaracter(reason),
      payToken: payToken.toString(),
    };

    try {
      const response = await fetch(`${this.config.baseUrl}mp/pay`, {
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
      console.error("Error processing payment:", error);
      return null;
    }
  }
}




