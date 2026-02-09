import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import {
  ServerRidesService,
  RideApiError,
} from "@/lib/services/server";

export const dynamic = "force-dynamic";

function parseQueryInt(value: string | null, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function optionalInt(searchParams: URLSearchParams, key: string): number | undefined {
  const v = searchParams.get(key);
  if (v == null || v === "") return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const { searchParams } = new URL(request.url);

    const params = {
      driver_id: searchParams.get("driver_id") ?? undefined,
      from_city: searchParams.get("from_city") ?? undefined,
      to_city: searchParams.get("to_city") ?? undefined,
      min_price: optionalInt(searchParams, "min_price"),
      max_price: optionalInt(searchParams, "max_price"),
      min_seats: optionalInt(searchParams, "min_seats"),
      upcoming: searchParams.get("upcoming") === "true",
      page: parseQueryInt(searchParams.get("page"), 1),
      limit: parseQueryInt(searchParams.get("limit"), 10),
    };

    const service = new ServerRidesService(supabase);
    const result = await service.getRides(params);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error in rides GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const rideData = await request.json();
    const service = new ServerRidesService(supabase);
    const data = await service.createRideForApi(session.user.id, rideData);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof RideApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error in rides POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
