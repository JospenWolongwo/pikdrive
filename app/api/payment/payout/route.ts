import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { PaymentApiError, ServerPaymentInitiationService } from "@/lib/services/server";
import type { PayoutRequest } from "@/types/payment-ext";

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          details: sessionError?.message,
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as PayoutRequest;
    const service = new ServerPaymentInitiationService();
    const result = await service.payout({
      ...body,
      userId: body.userId || session.user.id,
    });

    return NextResponse.json(result.response, { status: result.statusCode });
  } catch (error: any) {
    console.error("Payout error:", error);
    if (error instanceof PaymentApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Payout initiation failed",
      },
      { status: 500 }
    );
  }
}









