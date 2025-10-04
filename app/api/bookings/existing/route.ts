import { NextRequest, NextResponse } from 'next/server';`nimport { createApiSupabaseClient } from '@/lib/supabase/server-client';


import { BookingService } from '@/lib/services/booking-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const bookingService = new BookingService(supabase);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
