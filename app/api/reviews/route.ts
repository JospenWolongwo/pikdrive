import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerReviewService } from '@/lib/services/server';
import type { CreateReviewRequest } from '@/types/review';

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic';

/**
 * POST /api/reviews
 * Create a new review
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();

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

    // Parse request body
    const body: CreateReviewRequest = await request.json();
    const { booking_id, rating, comment, tags } = body;

    // Validate required fields
    if (!booking_id || !rating) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: booking_id, rating' },
        { status: 400 }
      );
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Create review
    const reviewService = new ServerReviewService(supabase);
    const result = await reviewService.createReview(userId, {
      booking_id,
      rating,
      comment,
      tags,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.review,
    });
  } catch (error) {
    console.error('[API] Error creating review:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reviews?reviewee_id={id}&limit={n}&offset={m}&rating={r}
 * Fetch reviews for a user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    const { searchParams } = new URL(request.url);

    const revieweeId = searchParams.get('reviewee_id');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const ratingParam = searchParams.get('rating');
    const rating = ratingParam ? parseInt(ratingParam) as 1 | 2 | 3 | 4 | 5 : undefined;

    if (!revieweeId) {
      return NextResponse.json(
        { success: false, error: 'reviewee_id is required' },
        { status: 400 }
      );
    }

    // Fetch reviews
    const reviewService = new ServerReviewService(supabase);
    const result = await reviewService.getReviewsForUser(revieweeId, {
      limit,
      offset,
      rating,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.reviews,
    });
  } catch (error) {
    console.error('[API] Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
