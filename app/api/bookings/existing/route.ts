import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerBookingService } from '@/lib/services/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    const bookingService = new ServerBookingService(supabase);
    
    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const user = session.user;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const rideId = searchParams.get('rideId');
    const userId = searchParams.get('userId');

    if (!rideId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: rideId, userId' },
        { status: 400 }
      );
    }

    const existingBooking = await bookingService.getExistingBookingForRide(rideId, userId);

    return NextResponse.json({
      success: true,
      data: existingBooking
    });
  } catch (error) {
    console.error('Existing booking check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check existing booking'
      },
      { status: 500 }
    );
  }
}
