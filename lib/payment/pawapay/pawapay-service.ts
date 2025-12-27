/**
 * pawaPay Service - Main Orchestrator
 * Coordinates payin, payout, and verification operations
 * Handles both MTN and Orange Money via pawaPay aggregator
 */

import type {
  PaymentApiRequest,
  PaymentServiceResponse,
  CheckPaymentServiceResponse,
  PayoutRequest,
  Environment,
} from "@/types/payment-ext";
import { PawaPayPayinService } from "./payin-service";
import { PawaPayPayoutService } from "./payout-service";
import { PawaPayVerificationService } from "./verification-service";

interface PawaPayConfig {
  readonly apiToken: string;
  readonly baseUrl: string;
  readonly callbackUrl: string;
  readonly environment: Environment;
}

export class PawaPayService {
  private readonly payinService: PawaPayPayinService;
  private readonly payoutService: PawaPayPayoutService;
  private readonly verificationService: PawaPayVerificationService;

  constructor(config: PawaPayConfig) {
    // Helper to mask sensitive values
    const maskToken = (token: string): string => {
      if (!token) return "NOT_SET";
      if (token.length <= 8) return "***";
      return `${token.substring(0, 4)}***${token.substring(token.length - 4)}`;
    };

    console.log("🔍 [PAWAPAY-SERVICE] Initializing with config:", {
      apiToken: maskToken(config.apiToken),
      apiTokenLength: config.apiToken.length,
      apiTokenExists: !!config.apiToken,
      baseUrl: config.baseUrl,
      callbackUrl: config.callbackUrl,
      environment: config.environment,
    });

    if (!config.apiToken) {
      console.error("❌ [PAWAPAY-SERVICE] Missing required pawaPay API token");
    } else {
      console.log("✅ [PAWAPAY-SERVICE] pawaPay service initialized");
    }

    this.payinService = new PawaPayPayinService({
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      callbackUrl: config.callbackUrl,
      environment: config.environment,
    });

    this.payoutService = new PawaPayPayoutService({
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      callbackUrl: config.callbackUrl,
      environment: config.environment,
    });

    this.verificationService = new PawaPayVerificationService({
      baseUrl: config.baseUrl,
      apiToken: config.apiToken,
      environment: config.environment,
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
    depositId: string
  ): Promise<{ statusCode: number; response: CheckPaymentServiceResponse }> {
    return this.verificationService.checkPayment(depositId);
  }

  async checkPayoutStatus(
    payoutId: string
  ): Promise<{
    status: string;
    amount?: string;
    currency?: string;
    transactionId?: string;
    reason?: string;
  } | null> {
    return this.verificationService.checkPayoutStatus(payoutId);
  }
}

