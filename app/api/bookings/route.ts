import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { BookingService } from '@/lib/services/booking-service';

export async function POST(request: NextRequest) {
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
      user_id: user.id,
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
    const userId = searchParams.get('userId');
    const driverId = searchParams.get('driverId');
    const status = searchParams.get('status');

    if (userId) {
      // Get user bookings
      const bookings = await bookingService.getUserBookings({
        userId,
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
