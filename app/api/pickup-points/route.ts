import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { ServerCityPickupPointsService } from "@/lib/services/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/pickup-points?city=Douala
 * Returns pickup points for the given city (for driver ride create/edit).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    if (!city || city.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Query param city is required" },
        { status: 400 }
      );
    }
    const supabase = createApiSupabaseClient();
    const service = new ServerCityPickupPointsService(supabase);
    const data = await service.list(city.trim());
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("Error in pickup-points GET:", e);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
