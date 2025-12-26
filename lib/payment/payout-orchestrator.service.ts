/**
 * Payment Orchestrator Service
 * Automatically selects the correct payment provider (MOMO or OM) based on phone number
 * Matches MOMO_OM_PAYMENT_ABSTRUCTION.md specifications
 */

import { MTNMomoService } from "./mtn-momo-service";
import { OrangeMoneyService } from "./orange-money-service";
import { PawaPayService } from "./pawapay/pawapay-service";
import type {
  PaymentApiRequest,
  PaymentServiceResponse,
  CheckPaymentServiceResponse,
  PayoutRequest,
  Environment,
} from "@/types/payment-ext";
import {
  FeatureFlag,
} from "@/types/payment-ext";
import {
  removeCallingCode,
  isOrangePhoneNumber,
  isMTNPhoneNumber,
} from "./phone-utils";

export class PayoutOrchestratorService {
  private momoService?: MTNMomoService;
  private omService?: OrangeMoneyService;
  private pawapayService?: PawaPayService;
  private usePawaPay: boolean;

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
    },
    pawapayConfig?: {
      readonly apiToken: string;
      readonly baseUrl: string;
      readonly callbackUrl: string;
      readonly environment: Environment;
    }
  ) {
    // Check if pawaPay should be used (via env var)
    this.usePawaPay = process.env.USE_PAWAPAY === FeatureFlag.USE_PAWAPAY && !!pawapayConfig;

    if (this.usePawaPay && pawapayConfig) {
      console.log("🔄 [ORCHESTRATOR] Using pawaPay aggregator");
      this.pawapayService = new PawaPayService(pawapayConfig);
    } else {
      console.log("🔄 [ORCHESTRATOR] Using direct providers (MTN/Orange)");
      this.momoService = new MTNMomoService(momoConfig);
      this.omService = new OrangeMoneyService(omConfig);
    }
  }

  async payout(
    request: PayoutRequest
  ): Promise<{
    statusCode: number;
    response: PaymentServiceResponse;
  }> {
    console.log("🎯 [ORCHESTRATOR] Payout request received:", {
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      currency: request.currency,
    });

    // Route to pawaPay if enabled
    if (this.usePawaPay && this.pawapayService) {
      console.log("🔄 [ORCHESTRATOR] Routing to pawaPay service");
      return await this.pawapayService.payout(request);
    }

    // Otherwise use direct providers
    const phone = removeCallingCode(request.phoneNumber);

    if (!phone) {
      console.error("❌ [ORCHESTRATOR] Invalid phone number");
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
      console.log("🍊 [ORCHESTRATOR] Routing to Orange Money service");
      return await this.omService!.payout(request);
    }

    // Check if MTN number
    if (isMTNPhoneNumber(request.phoneNumber)) {
      console.log("📱 [ORCHESTRATOR] Routing to MTN MOMO service");
      return await this.momoService!.payout(request);
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
    // Route to pawaPay if enabled
    if (this.usePawaPay && this.pawapayService) {
      console.log("🔄 [ORCHESTRATOR] Routing to pawaPay service");
      return await this.pawapayService.payin(request);
    }

    // Otherwise use direct providers
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
      return await this.omService!.payin(request);
    }

    // Check if MTN number
    if (isMTNPhoneNumber(request.phoneNumber)) {
      return await this.momoService!.payin(request);
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
    // Route to pawaPay if enabled
    if (this.usePawaPay && this.pawapayService) {
      console.log("🔄 [ORCHESTRATOR] Checking payment via pawaPay");
      return await this.pawapayService.checkPayment(payToken);
    }

    // Otherwise use direct providers
    // Check if Orange Money number
    if (isOrangePhoneNumber(phoneNumber)) {
      return await this.omService!.checkPayment(payToken);
    }

    // Check if MTN number
    if (isMTNPhoneNumber(phoneNumber)) {
      return await this.momoService!.checkPayment(payToken);
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










