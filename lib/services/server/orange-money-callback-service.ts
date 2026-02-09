import type { SupabaseClient } from "@supabase/supabase-js";
import { ServerPaymentService } from "./payment-service";
import { ServerPaymentOrchestrationService } from "./payment-orchestration-service";
import { mapOrangeMoneyStatus } from "@/lib/payment";

export class OrangeMoneyCallbackError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "OrangeMoneyCallbackError";
    this.statusCode = statusCode;
  }
}

export class ServerOrangeMoneyCallbackService {
  private paymentService: ServerPaymentService;
  private orchestrationService: ServerPaymentOrchestrationService;

  constructor(private supabase: SupabaseClient) {
    this.paymentService = new ServerPaymentService(supabase);
    this.orchestrationService = new ServerPaymentOrchestrationService(supabase);
  }

  async handleCallback(callback: any): Promise<{
    referenceId: string;
    mappedStatus: string;
    txid?: string;
  }> {
    const txid = callback.txid || callback.transactionId || callback.orderId;
    const orderId = callback.orderId || callback.transactionId || txid;
    const status = callback.status;
    const txnmessage = callback.txnmessage || callback.message;

    if (!orderId && !txid) {
      throw new OrangeMoneyCallbackError("Missing orderId or txid", 400);
    }

    const referenceId = orderId || txid;
    let payment = await this.paymentService.getPaymentByTransactionId(referenceId);

    if (!payment && referenceId) {
      try {
        const { data } = await this.supabase
          .from("payments")
          .select("*")
          .eq("id", referenceId)
          .single();
        if (data) payment = data as any;
      } catch (e) {
        console.log("Payment not found by ID:", referenceId);
      }
    }

    if (!payment) {
      throw new OrangeMoneyCallbackError(
        "Callback received, payment not found",
        200
      );
    }

    const mappedStatus = mapOrangeMoneyStatus(status);

    await this.orchestrationService.handlePaymentStatusChange(
      payment,
      mappedStatus,
      {
        transaction_id: txid || orderId,
        provider_response: callback,
        error_message: txnmessage || undefined,
      }
    );

    return { referenceId, mappedStatus, txid };
  }
}
