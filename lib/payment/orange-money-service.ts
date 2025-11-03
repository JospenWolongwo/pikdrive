/**
 * Orange Money Service - Main Orchestrator
 * Coordinates payin, payout, and verification operations
 */

import type {
  PaymentApiRequest,
  PaymentServiceResponse,
  CheckPaymentServiceResponse,
  PayoutRequest,
} from "@/types/payment-ext";
import { OrangeTokenService } from "./orange/token-service";
import { OrangePayinService } from "./orange/payin-service";
import { OrangePayoutService } from "./orange/payout-service";
import { OrangeVerificationService } from "./orange/verification-service";

interface OrangeMoneyConfig {
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

export class OrangeMoneyService {
  private readonly tokenService: OrangeTokenService;
  private readonly payinService: OrangePayinService;
  private readonly payoutService: OrangePayoutService;
  private readonly verificationService: OrangeVerificationService;

  constructor(config: OrangeMoneyConfig) {
    const tokenUrl =
      config.tokenUrl ||
      (config.environment === "production"
        ? "https://api.orange.cm/oauth/"
        : process.env.DIRECT_OM_TOKEN_URL ||
          "https://api.orange-sonatel.com/oauth/");

    const baseUrl =
      config.baseUrl ||
      (config.environment === "production"
        ? "https://api.orange.cm/"
        : process.env.DIRECT_OM_BASE_URL ||
          "https://api.orange-sonatel.com/");

    const consumerUser =
      config.consumerUser ||
      process.env.DIRECT_OM_CONSUMER_USER ||
      config.merchantId;

    const consumerSecret =
      config.consumerSecret ||
      process.env.DIRECT_OM_CONSUMER_SECRET ||
      config.merchantKey;

    const apiUsername =
      config.apiUsername || process.env.DIRECT_OM_API_USERNAME || "";

    const apiPassword =
      config.apiPassword || process.env.DIRECT_OM_API_PASSWORD || "";

    const pinCode = config.pinCode || process.env.DIRECT_OM_PIN_CODE || "";

    const merchantNumber =
      config.merchantNumber ||
      process.env.DIRECT_OM_MERCHAND_NUMBER ||
      config.merchantId;

    const notificationUrl =
      process.env.DIRECT_OM_CALLBACK_URL || config.notificationUrl;

    this.tokenService = new OrangeTokenService({
      tokenUrl,
      consumerUser,
      consumerSecret,
    });

    this.payinService = new OrangePayinService({
      baseUrl,
      tokenService: this.tokenService,
      apiUsername,
      apiPassword,
      pinCode,
      merchantNumber,
      notificationUrl,
    });

    this.payoutService = new OrangePayoutService({
      baseUrl,
      tokenService: this.tokenService,
      apiUsername,
      apiPassword,
      pinCode,
      merchantNumber,
    });

    this.verificationService = new OrangeVerificationService({
      baseUrl,
      tokenService: this.tokenService,
      apiUsername,
      apiPassword,
    });
  }

  async payin(
    request: PaymentApiRequest
  ): Promise<{ statusCode: number; response: PaymentServiceResponse }> {
    return this.payinService.payin(request);
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
   * Verify webhook signature
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string
  ): Promise<boolean> {
    const calculatedSignature = await generateHmac(
      process.env.ORANGE_MONEY_MERCHANT_KEY || "",
      payload
    );
    return calculatedSignature === signature;
  }
}

async function generateHmac(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
