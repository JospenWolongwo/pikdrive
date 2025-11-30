import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerBookingService } from '@/lib/services/server/booking-service';

// Force dynamic rendering since this route uses cookies() via createApiSupabaseClient()
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Create a Supabase client using cookie-based authentication
    const supabase = createApiSupabaseClient();

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

    const userId = session.user.id;
    const bookingService = new ServerBookingService(supabase);

    // Get request body
    const body = await request.json();
    const { ride_id, seats } = body;

    if (!ride_id || !seats) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: ride_id, seats' },
        { status: 400 }
      );
    }

    // Create booking
    const booking = await bookingService.createBooking({
      ride_id,
      user_id: userId,
      seats
    });

    return NextResponse.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create booking'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Create a Supabase client using cookie-based authentication
    const supabase = createApiSupabaseClient();

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

    const currentUserId = session.user.id;
    const bookingService = new ServerBookingService(supabase);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const driverId = searchParams.get('driverId');
    const status = searchParams.get('status');

    if (requestedUserId) {
      // Get user bookings
      const bookings = await bookingService.getUserBookings({
        userId: requestedUserId,
        status: status || undefined
      });

      return NextResponse.json({
        success: true,
        data: bookings
      });
    } else if (driverId) {
      // Get driver bookings
      const bookings = await bookingService.getDriverBookings({
        userId: driverId,
        status: status || undefined
      });

      return NextResponse.json({
        success: true,
        data: bookings
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing userId or driverId parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Booking fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch bookings'
      },
      { status: 500 }
    );
  }
}
