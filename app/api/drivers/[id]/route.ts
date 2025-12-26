import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { ServerDriverService } from "@/lib/services/server/driver-service";

interface RouteParams {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    console.log('🔍 [API /drivers/[id]] Fetching driver profile:', params.id);
    
    const supabase = createApiSupabaseClient();
    const driverService = new ServerDriverService(supabase);

    const profile = await driverService.getPublicDriverProfile(params.id);

    if (!profile) {
      console.error("❌ [API /drivers/[id]] Driver not found or not approved");
      return NextResponse.json(
        { success: false, error: "Driver not found or not approved" },
        { status: 404 }
      );
    }

    console.log('✅ [API /drivers/[id]] Profile retrieved, sending response:', {
      success: true,
      has_data: !!profile,
      profile_id: profile.id,
      profile_name: profile.full_name,
      avatar_url: profile.avatar_url,
      vehicle_images_count: profile.vehicle_images?.length || 0,
    });

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

