import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server-client";
import { updateDriverStatus } from "@/lib/driver-application-utils";

/**
 * API route to update driver status (approve/reject/inactive)
 * Requires admin authentication and uses service role key for the actual update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const driverId = params.id;

    if (!driverId) {
      return NextResponse.json(
        { error: "Driver ID is required" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || !["approved", "rejected", "inactive"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'approved', 'rejected', or 'inactive'" },
        { status: 400 }
      );
    }

    // Verify admin access using authenticated client
    const supabase = createApiSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", details: authError?.message },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Access denied. Admin role required." },
        { status: 403 }
      );
    }

    // Create service role client for the actual update (bypasses RLS)
    let adminClient;
    try {
      adminClient = createServiceRoleClient();
    } catch (error) {
      console.error("Failed to create service role client:", error);
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Update driver status using the utility function
    const result = await updateDriverStatus(
      adminClient,
      driverId,
      status as "approved" | "rejected" | "inactive"
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to update driver status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Driver status updated to ${status}`,
    });
  } catch (error) {
    console.error("Error updating driver status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support POST for backward compatibility
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return PATCH(request, { params });
}

