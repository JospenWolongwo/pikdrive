import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerReviewService } from '@/lib/services/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/reviews/user/[userId]
 * Fetch reviews and statistics for a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createApiSupabaseClient();
    const { userId } = params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeStats = searchParams.get('include_stats') === 'true';

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const reviewService = new ServerReviewService(supabase);

    // Fetch reviews
    const reviewsResult = await reviewService.getReviewsForUser(userId, {
      limit,
      offset,
    });

    if (!reviewsResult.success) {
      return NextResponse.json(
        { success: false, error: reviewsResult.error },
        { status: 400 }
      );
    }

    // Optionally include statistics
    let statistics = undefined;
    if (includeStats) {
      statistics = await reviewService.getReviewStatistics(userId);
    }

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviewsResult.reviews,
        statistics,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching user reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
