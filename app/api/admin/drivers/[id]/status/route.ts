import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { changeDriverStatusAsAdmin } from "@/lib/services/server";

// Force dynamic rendering since this route uses cookies() via createApiSupabaseClient()
export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'Driver ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['approved', 'rejected', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'approved', 'rejected', or 'inactive'" },
        { status: 400 }
      );
    }

    const supabase = createApiSupabaseClient();
    const result = await changeDriverStatusAsAdmin(supabase, driverId, status as 'approved' | 'rejected' | 'inactive');

    if (!result.success) {
      // Map known errors to appropriate status codes
      if (result.error === 'Unauthorized') {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      if (result.error?.includes('Access denied')) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ error: result.error || 'Failed to update driver status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Driver status updated to ${status}` });
  } catch (error) {
    console.error('Error updating driver status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
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

