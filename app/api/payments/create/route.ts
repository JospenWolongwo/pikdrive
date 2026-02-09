import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { PaymentApiError, ServerPaymentCreationService } from "@/lib/services/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookingId, amount, provider, phoneNumber, idempotencyKey } = body;

    const paymentCreationService = new ServerPaymentCreationService(supabase);
    const { payment, transactionId } = await paymentCreationService.createPayment({
      bookingId,
      amount,
      provider,
      phoneNumber,
      userId: session.user.id,
      idempotencyKey,
    });

    console.log("ðŸŽ¯ Payment creation complete - returning response:", {
      paymentId: payment.id,
      transactionId,
      bookingId: payment.booking_id,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...payment,
        transaction_id: transactionId || undefined,
        status: "processing",
      },
      message: "Payment initiated successfully",
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    if (error instanceof PaymentApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Payment creation failed",
      },
      { status: 500 }
    );
  }
}
