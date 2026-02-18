import { NextRequest, NextResponse } from "next/server";
import {
  createApiSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server-client";
import {
  RideCancellationError,
  ServerRideCancellationService,
} from "@/lib/services/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createApiSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      reason?: string;
    };
    const reason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : undefined;

    const serviceSupabase = createServiceRoleClient();
    const cancellationService = new ServerRideCancellationService(
      supabase,
      serviceSupabase
    );

    const result = await cancellationService.cancelRide({
      rideId: params.id,
      driverId: session.user.id,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: "Ride cancelled successfully",
      data: result,
    });
  } catch (error) {
    console.error("Ride cancellation error:", error);
    if (error instanceof RideCancellationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to cancel ride",
      },
      { status: 500 }
    );
  }
}

