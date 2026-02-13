import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerReviewService } from '@/lib/services/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/reviews/check-eligibility/[bookingId]
 * Check if user can review a specific booking
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const supabase = await createApiSupabaseClient();
    const { bookingId } = params;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'bookingId is required' },
        { status: 400 }
      );
    }

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', details: sessionError?.message },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check eligibility
    const reviewService = new ServerReviewService(supabase);
    const eligibility = await reviewService.canUserReview(userId, bookingId);

    return NextResponse.json({
      success: true,
      data: eligibility,
    });
  } catch (error) {
    console.error('[API] Error checking review eligibility:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
