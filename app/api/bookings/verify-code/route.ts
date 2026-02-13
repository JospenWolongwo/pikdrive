import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { BookingApiError, ServerBookingService } from '@/lib/services/server';

export async function POST(request: Request) {
  try {
    const supabase = await createApiSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { bookingId, verificationCode } = body ?? {};

    const bookingService = new ServerBookingService(supabase);
    const result = await bookingService.verifyCodeAndHandlePayout({
      bookingId,
      verificationCode,
      driverId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
      payoutInitiated: result.payoutInitiated,
      driverEarnings: result.driverEarnings,
      paymentCount: result.paymentCount,
    });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify code',
      },
      { status: 500 }
    );
  }
}
