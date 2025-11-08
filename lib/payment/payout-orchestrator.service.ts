/**
 * Payment Orchestrator Service
 * Automatically selects the correct payment provider (MOMO or OM) based on phone number
 * Matches MOMO_OM_PAYMENT_ABSTRUCTION.md specifications
 */

import { MTNMomoService } from "./mtn-momo-service";
import { OrangeMoneyService } from "./orange-money-service";
import type {
  PaymentApiRequest,
  PaymentServiceResponse,
  CheckPaymentServiceResponse,
  PayoutRequest,
} from "@/types/payment-ext";
import {
  removeCallingCode,
  isOrangePhoneNumber,
  isMTNPhoneNumber,
} from "./phone-utils";

export class PayoutOrchestratorService {
  private momoService: MTNMomoService;
  private omService: OrangeMoneyService;

  constructor(
    momoConfig: {
      subscriptionKey: string;
      apiKey: string;
      targetEnvironment: "sandbox" | "production";
      callbackHost: string;
      collectionPrimaryKey: string;
      collectionUserId: string;
      disbursementApiUser?: string;
      disbursementApiKey?: string;
      disbursementSubscriptionKey?: string;
    },
    omConfig: {
      merchantId: string;
      merchantKey: string;
      environment: "sandbox" | "production";
      notificationUrl: string;
      returnUrl: string;
      consumerUser?: string;
      consumerSecret?: string;
      apiUsername?: string;
      apiPassword?: string;
      pinCode?: string;
      merchantNumber?: string;
      tokenUrl?: string;
      baseUrl?: string;
    }
  ) {
    this.momoService = new MTNMomoService(momoConfig);
    this.omService = new OrangeMoneyService(omConfig);
  }

  async payout(
    request: PayoutRequest
  ): Promise<{
    statusCode: number;
    response: PaymentServiceResponse;
  }> {
    const phone = removeCallingCode(request.phoneNumber);

    if (!phone) {
      return {
        statusCode: 400,
        response: {
          success: false,
          message: "Invalid phone number",
          verificationToken: null,
          apiResponse: null,
        },
      };
    }

    // Check if Orange Money number
    if (isOrangePhoneNumber(request.phoneNumber)) {
      return await this.omService.payout(request);
    }

    // Check if MTN number
    if (isMTNPhoneNumber(request.phoneNumber)) {
      return await this.momoService.payout(request);
    }

    return {
      statusCode: 400,
      response: {
        success: false,
        message: "Unsupported operator for this phone number",
        verificationToken: null,
        apiResponse: null,
      },
    };
  }

  async payin(
    request: PaymentApiRequest
  ): Promise<{
    statusCode: number;
    response: PaymentServiceResponse;
  }> {
    const phone = removeCallingCode(request.phoneNumber);

    if (!phone) {
      return {
        statusCode: 400,
        response: {
          success: false,
          message: "Invalid phone number",
          verificationToken: null,
          apiResponse: null,
        },
      };
    }

    // Check if Orange Money number
    if (isOrangePhoneNumber(request.phoneNumber)) {
      return await this.omService.payin(request);
    }

    // Check if MTN number
    if (isMTNPhoneNumber(request.phoneNumber)) {
      return await this.momoService.payin(request);
    }

    return {
      statusCode: 400,
      response: {
        success: false,
        message: "Unsupported operator for this phone number",
        verificationToken: null,
        apiResponse: null,
      },
    };
  }

  async checkPayment(
    payToken: string,
    phoneNumber: string
  ): Promise<{
    statusCode: number;
    response: CheckPaymentServiceResponse;
  }> {
    // Check if Orange Money number
    if (isOrangePhoneNumber(phoneNumber)) {
      return await this.omService.checkPayment(payToken);
    }

    // Check if MTN number
    if (isMTNPhoneNumber(phoneNumber)) {
      return await this.momoService.checkPayment(payToken);
    }

    return {
      statusCode: 400,
      response: {
        success: false,
        message: "Unsupported operator",
        status: 400,
        transactionStatus: null,
        transactionAmount: 0,
        apiResponse: null,
      },
    };
  }
}








