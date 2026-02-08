import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { BookingApiError, ServerBookingService } from '@/lib/services/server/bookings';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bookingId = request.nextUrl.searchParams.get('bookingId');
    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'Missing bookingId' },
        { status: 400 }
      );
    }

    const bookingService = new ServerBookingService(supabase);
    const { verificationCode, codeVerified, codeExpiry } =
      await bookingService.getVerificationCodeForUser(bookingId, user.id);

    return NextResponse.json({
      success: true,
      verificationCode,
      codeVerified,
      codeExpiry,
    });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    console.error('Verification code fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch verification code',
      },
      { status: 500 }
    );
  }
}
