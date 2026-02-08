import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { BookingApiError, ServerBookingService } from '@/lib/services/server/bookings';

// Backup API endpoint that directly uses the RPC function for simplicity
export async function POST(request: Request) {
  try {
    const supabase = createApiSupabaseClient();

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
    const { verificationCode } = await bookingService.generateVerificationCodeForUser(
      bookingId,
      user.id
    );

    return NextResponse.json({
      success: true,
      verificationCode,
      message: 'Code generated successfully via backup API'
    });
  } catch (error) {
    if (error instanceof BookingApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('API BACKUP: Error in code generator endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate verification code'
      },
      { status: 500 }
    );
  }
}
