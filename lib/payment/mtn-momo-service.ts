/**
 * MTN MOMO Service - Main Orchestrator
 * Coordinates payin, payout, and verification operations
 */

import type {
  PaymentApiRequest,
  PaymentServiceResponse,
  CheckPaymentServiceResponse,
  PayoutRequest,
} from "@/types/payment-ext";
import { MTNTokenService } from "./mtn/token-service";
import { MTNPayinService } from "./mtn/payin-service";
import { MTNPayoutService } from "./mtn/payout-service";
import { MTNVerificationService } from "./mtn/verification-service";
import { TextEncoder } from "util";

interface MomoConfig {
  subscriptionKey: string;
  apiKey: string;
  targetEnvironment: "sandbox" | "production";
  callbackHost: string;
  collectionPrimaryKey: string;
  collectionUserId: string;
  disbursementApiUser?: string;
  disbursementApiKey?: string;
  disbursementSubscriptionKey?: string;
}

export class MTNMomoService {
  private readonly baseUrl: string;
  private readonly tokenService: MTNTokenService;
  private readonly payinService: MTNPayinService;
  private readonly payoutService: MTNPayoutService;
  private readonly verificationService: MTNVerificationService;

  constructor(config: MomoConfig) {
    this.baseUrl =
      config.targetEnvironment === "production"
        ? "https://api.mtn.cm"
        : "https://sandbox.momodeveloper.mtn.com";

    const callbackUrl =
      process.env.DIRECT_MOMO_CALLBACK_URL ||
      `${config.callbackHost}/api/callbacks/momo`;

    const payoutCallbackUrl =
      process.env.DIRECT_MOMO_PAYOUT_CALLBACK_URL ||
      `${config.callbackHost}/api/callbacks/momo-payout`;

    console.log("🔧 [MTN-SERVICE] Initializing MTNTokenService with config:", {
      baseUrl: this.baseUrl,
      hasSubscriptionKey: !!config.subscriptionKey,
      hasCollectionUserId: !!config.collectionUserId,
      hasCollectionApiKey: !!config.apiKey,
      hasDisbursementApiUser: !!config.disbursementApiUser,
      hasDisbursementApiKey: !!config.disbursementApiKey,
      hasDisbursementSubscriptionKey: !!config.disbursementSubscriptionKey,
      disbursementApiUser: config.disbursementApiUser ? `${config.disbursementApiUser.substring(0, 4)}...` : 'undefined',
      disbursementApiKey: config.disbursementApiKey ? `${config.disbursementApiKey.substring(0, 4)}...` : 'undefined',
    });

    this.tokenService = new MTNTokenService({
      baseUrl: this.baseUrl,
      subscriptionKey: config.subscriptionKey,
      collectionUserId: config.collectionUserId,
      collectionApiKey: config.apiKey,
      disbursementApiUser: config.disbursementApiUser,
      disbursementApiKey: config.disbursementApiKey,
      disbursementSubscriptionKey: config.disbursementSubscriptionKey,
    });

    this.payinService = new MTNPayinService({
      baseUrl: this.baseUrl,
      subscriptionKey: config.subscriptionKey,
      callbackUrl,
      tokenService: this.tokenService,
      targetEnvironment: config.targetEnvironment,
    });

    this.payoutService = new MTNPayoutService({
      baseUrl: this.baseUrl,
      subscriptionKey: config.subscriptionKey,
      disbursementSubscriptionKey: config.disbursementSubscriptionKey,
      callbackUrl: payoutCallbackUrl,
      tokenService: this.tokenService,
      targetEnvironment: config.targetEnvironment,
    });

    this.verificationService = new MTNVerificationService({
      baseUrl: this.baseUrl,
      subscriptionKey: config.subscriptionKey,
      tokenService: this.tokenService,
      targetEnvironment: config.targetEnvironment,
    });
  }

  async payin(
    request: PaymentApiRequest,
    callbackUrlOverride?: string
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    return this.payinService.payin(request, callbackUrlOverride);
  }

  async payout(
    request: PayoutRequest
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    return this.payoutService.payout(request);
  }

  async checkPayment(
    payToken: string
  ): Promise<{ statusCode: number; response: CheckPaymentServiceResponse }> {
    return this.verificationService.checkPayment(payToken);
  }

  /**
   * Request to pay - wrapper method for payment creation route
   * Maps route handler parameters to payin() method call
   */
  async requestToPay(params: {
    readonly amount: number;
    readonly currency: string;
    readonly phoneNumber: string;
    readonly externalId: string;
    readonly payerMessage: string;
    readonly payeeNote: string;
    readonly callbackUrl: string;
  }): Promise<{ transactionId: string }> {
    // Map parameters to PaymentApiRequest format
    // Use payerMessage as reason since it's more descriptive
    const payinRequest: PaymentApiRequest = {
      phoneNumber: params.phoneNumber,
      amount: params.amount,
      reason: params.payerMessage,
    };

    // Call the payin service with callbackUrl override
    // The callbackUrl should match what's configured in MTN Developer Portal
    const result = await this.payin(payinRequest, params.callbackUrl);

    // Check if payment was initiated successfully
    if (result.statusCode !== 200 || !result.response.success || !result.response.verificationToken) {
      throw new Error(
        result.response.message || "Failed to initiate payment"
      );
    }

    // Return transactionId from verificationToken
    return {
      transactionId: result.response.verificationToken,
    };
  }

  /**
   * Validate webhook signature
   */
  async validateWebhookSignature(
    signature: string,
    body: string
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(process.env.DIRECT_MOMO_COLLECTION_PRIMARY_KEY || "");
    const messageData = encoder.encode(body);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData as BufferSource
    );
    const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return signature === calculatedSignature;
  }
}
