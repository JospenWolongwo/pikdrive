import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { BookingApiError, ServerBookingService } from '@/lib/services/server';

/**
 * API endpoint to manually refresh/regenerate verification code for a booking
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const bookingService = new ServerBookingService(supabase);
    const { verificationCode, codeExpiry } =
      await bookingService.refreshVerificationCodeForOwner(bookingId, user.id);

    return NextResponse.json({
      success: true,
      verificationCode,
      expiryTime: codeExpiry,
    });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error refreshing verification code:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
