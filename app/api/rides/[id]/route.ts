import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import type { UpdateRideRequest } from "@/types";
import {
  ServerRidesService,
  RideApiError,
} from "@/lib/services/server/rides";

interface RouteParams {
  params: { id: string };
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof RideApiError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode }
    );
  }
  return NextResponse.json(
    {
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createApiSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          details: sessionError?.message,
        },
        { status: 401 }
      );
    }

    const service = new ServerRidesService(supabase);
    const data = await service.getRideByIdForApi(params.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createApiSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const updateData: UpdateRideRequest = await request.json();
    const service = new ServerRidesService(supabase);
    const data = await service.updateRideByDriver(
      params.id,
      session.user.id,
      updateData
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof RideApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error in ride PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createApiSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const service = new ServerRidesService(supabase);
    await service.deleteRideByDriver(params.id, session.user.id);
    return NextResponse.json({
      success: true,
      message: "Ride deleted successfully",
    });
  } catch (error) {
    if (error instanceof RideApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error in ride DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
