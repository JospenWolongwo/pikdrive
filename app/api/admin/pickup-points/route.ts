import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { ServerCityPickupPointsService } from "@/lib/services/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const auth = await requireAdmin(supabase);
    if ("status" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }
    const { searchParams } = new URL(request.url);
    const cityParam = searchParams.get("city");
    const city =
      cityParam != null && cityParam.trim() !== ""
        ? cityParam.trim()
        : undefined;
    const service = new ServerCityPickupPointsService(supabase);
    const data = await service.list(city);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("Error in admin pickup-points GET:", e);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const auth = await requireAdmin(supabase);
    if ("status" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }
    const body = await request.json();
    const service = new ServerCityPickupPointsService(supabase);
    const data = await service.create({
      city: body.city,
      name: body.name,
      display_order: body.display_order,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    const status =
      message.includes("required") ||
      message.includes("allowed cities") ||
      message.includes("already exists")
        ? 400
        : 500;
    console.error("Error in admin pickup-points POST:", e);
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
