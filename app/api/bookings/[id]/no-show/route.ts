import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server-client';
import { BookingApiError, ServerBookingService } from '@/lib/services/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createApiSupabaseClient();
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
    const { contactAttempted, note } = body ?? {};

    const result = await bookingService.markPassengerNoShow({
      bookingId: params.id,
      driverId: user.id,
      contactAttempted: Boolean(contactAttempted),
      note: typeof note === 'string' ? note : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'No-show recorded successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          errorCode: error.errorCode,
        },
        { status: error.statusCode }
      );
    }

    console.error('Booking no-show error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to record passenger no-show',
      },
      { status: 500 }
    );
  }
}
