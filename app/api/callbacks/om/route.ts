import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { ServerPaymentService } from "@/lib/services/server/payment-service";
import { ServerPaymentOrchestrationService } from "@/lib/services/server/payment-orchestration-service";
import { mapOrangeMoneyStatus } from "@/lib/payment/status-mapper";

/**
 * Orange Money Callback Handler
 * Handles webhooks from Orange Money for both payin and payout transactions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const paymentService = new ServerPaymentService(supabase);
    const orchestrationService = new ServerPaymentOrchestrationService(supabase);

    const callback = await request.json();
    console.log("[CALLBACK] Orange Money Callback received:", callback);

    // Extract transaction details from Orange Money callback
    // OM callbacks can vary in structure, so we handle multiple formats
    const txid = callback.txid || callback.transactionId || callback.orderId;
    const orderId = callback.orderId || callback.transactionId || txid;
    const amount = callback.amount;
    const subscriberMsisdn = callback.subscriberMsisdn || callback.phoneNumber;
    const status = callback.status;
    const txnmessage = callback.txnmessage || callback.message;

    if (!orderId && !txid) {
      console.error("[CALLBACK] No orderId or txid in Orange Money callback");
      return NextResponse.json(
        { error: "Missing orderId or txid" },
        { status: 400 }
      );
    }

    // Try to find payment by orderId or transactionId
    const referenceId = orderId || txid;
    let payment = await paymentService.getPaymentByTransactionId(referenceId);

    // If not found by transaction ID, try to find by payment ID
    if (!payment && referenceId) {
      try {
        const { data } = await supabase
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
      console.error("[CALLBACK] Payment not found for orderId:", referenceId);
      // Return 200 to acknowledge receipt
      return NextResponse.json(
        { message: "Callback received, payment not found" },
        { status: 200 }
      );
    }

    // Map Orange Money status to our payment status
    const mappedStatus = mapOrangeMoneyStatus(status);

    // Update payment status via orchestration service
    await orchestrationService.handlePaymentStatusChange(payment, mappedStatus, {
      transaction_id: txid || orderId,
      provider_response: callback,
      error_message: txnmessage || undefined,
    });

    console.log("[CALLBACK] Orange Money callback processed:", {
      orderId: referenceId,
      status: mappedStatus,
      txid,
    });

    return NextResponse.json({ message: "Callback received" }, { status: 200 });
  } catch (error) {
    console.error("[CALLBACK] Error processing Orange Money callback:", error);
    return NextResponse.json(
      { message: "Callback received" },
      { status: 200 }
    );
  }
}


