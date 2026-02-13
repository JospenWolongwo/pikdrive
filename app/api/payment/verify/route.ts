import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { PaymentApiError, ServerPaymentInitiationService } from "@/lib/services/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();

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

    const body = (await request.json()) as { payToken: string; phoneNumber: string };
    const service = new ServerPaymentInitiationService();
    const result = await service.verifyPayment(body);

    return NextResponse.json(result.response, { status: result.statusCode });
  } catch (error: any) {
    console.error("Verify payment error:", error);
    if (error instanceof PaymentApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Payment verification failed",
      },
      { status: 500 }
    );
  }
}













