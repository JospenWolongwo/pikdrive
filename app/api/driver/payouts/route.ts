import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // Filter by status: pending, processing, completed, failed
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('payouts')
      .select(`
        *,
        booking:bookings(
          id,
          seats,
          status,
          created_at,
          ride:rides(
            id,
            from_city,
            to_city,
            departure_time
          )
        ),
        payment:payments(
          id,
          amount,
          currency,
          provider
        )
      `)
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: payouts, error: payoutsError } = await query;

    if (payoutsError) {
      console.error('Error fetching payouts:', payoutsError);
      return NextResponse.json(
        { error: 'Failed to fetch payouts', details: payoutsError.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const { data: allPayouts, error: statsError } = await supabase
      .from('payouts')
      .select('amount, status, created_at')
      .eq('driver_id', user.id);

    if (statsError) {
      console.error('Error fetching payout statistics:', statsError);
    }

    // Calculate statistics
    const statistics = {
      totalEarnings: 0,
      pendingAmount: 0,
      processingAmount: 0,
      completedCount: 0,
      completedAmount: 0,
      failedCount: 0,
      thisMonthEarnings: 0,
      totalCount: allPayouts?.length || 0,
    };

    if (allPayouts) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      allPayouts.forEach((payout) => {
        const payoutDate = new Date(payout.created_at);
        
        if (payout.status === 'completed') {
          statistics.completedCount++;
          statistics.completedAmount += parseFloat(payout.amount.toString());
          statistics.totalEarnings += parseFloat(payout.amount.toString());
          
          if (payoutDate >= startOfMonth) {
            statistics.thisMonthEarnings += parseFloat(payout.amount.toString());
          }
        } else if (payout.status === 'pending') {
          statistics.pendingAmount += parseFloat(payout.amount.toString());
        } else if (payout.status === 'processing') {
          statistics.processingAmount += parseFloat(payout.amount.toString());
        } else if (payout.status === 'failed') {
          statistics.failedCount++;
        }
      });
    }

    return NextResponse.json({
      payouts: payouts || [],
      statistics,
      pagination: {
        limit,
        offset,
        total: allPayouts?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/driver/payouts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

