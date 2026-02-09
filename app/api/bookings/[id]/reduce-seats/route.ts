import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server-client';
import { BookingApiError, ServerBookingService } from '@/lib/services/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createApiSupabaseClient();
    const serviceSupabase = createServiceRoleClient();
    const bookingService = new ServerBookingService(supabase, serviceSupabase);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { newSeats } = body ?? {};

    const result = await bookingService.reduceSeatsWithRefund({
      bookingId: params.id,
      userId: user.id,
      newSeats,
    });

    return NextResponse.json({
      success: true,
      message: 'Seats reduced successfully',
      refundInitiated: result.refundInitiated,
      refundAmount: result.refundAmount,
      newSeats: result.newSeats,
      seatsRemoved: result.seatsRemoved,
    });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Partial cancellation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to reduce seats' },
      { status: 500 }
    );
  }
}
