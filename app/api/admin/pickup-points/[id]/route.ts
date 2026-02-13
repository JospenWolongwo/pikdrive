import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { ServerCityPickupPointsService } from "@/lib/services/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createApiSupabaseClient();
    const auth = await requireAdmin(supabase);
    if ("status" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }
    const { id } = await params;
    const body = await request.json();
    const service = new ServerCityPickupPointsService(supabase);
    const data = await service.update(id, {
      name: body.name,
      display_order: body.display_order,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    const status =
      message.includes("No fields") ||
      message.includes("already exists")
        ? 400
        : 500;
    console.error("Error in admin pickup-points PATCH:", e);
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createApiSupabaseClient();
    const auth = await requireAdmin(supabase);
    if ("status" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }
    const { id } = await params;
    const service = new ServerCityPickupPointsService(supabase);
    await service.delete(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    const status = message.includes("Cannot delete") ? 400 : 500;
    console.error("Error in admin pickup-points DELETE:", e);
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
