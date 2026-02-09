import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { OrangeMoneyCallbackError, ServerOrangeMoneyCallbackService } from "@/lib/services/server";

/**
 * Orange Money Callback Handler
 * Handles webhooks from Orange Money for both payin and payout transactions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const callbackService = new ServerOrangeMoneyCallbackService(supabase);

    const callback = await request.json();
    console.log("[CALLBACK] Orange Money Callback received:", callback);
    const result = await callbackService.handleCallback(callback);
    console.log("[CALLBACK] Orange Money callback processed:", {
      orderId: result.referenceId,
      status: result.mappedStatus,
      txid: result.txid,
    });

    return NextResponse.json({ message: "Callback received" }, { status: 200 });
  } catch (error) {
    console.error("[CALLBACK] Error processing Orange Money callback:", error);
    if (error instanceof OrangeMoneyCallbackError && error.statusCode === 200) {
      return NextResponse.json({ message: error.message }, { status: 200 });
    }
    if (error instanceof OrangeMoneyCallbackError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { message: "Callback received" },
      { status: 200 }
    );
  }
}
