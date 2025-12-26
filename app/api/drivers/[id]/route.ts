import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { ServerDriverService } from "@/lib/services/server/driver-service";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createApiSupabaseClient();
    const driverService = new ServerDriverService(supabase);

    const profile = await driverService.getPublicDriverProfile(params.id);

    if (!profile) {
      console.error("❌ [GET /api/drivers/[id]] Driver not found or not approved");
      return NextResponse.json(
        { success: false, error: "Driver not found or not approved" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("❌ [GET /api/drivers/[id]] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

