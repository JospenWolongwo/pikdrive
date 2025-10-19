import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerBookingService } from '@/lib/services/server/booking-service';
import { ServerOneSignalNotificationService } from '@/lib/services/server/onesignal-notification-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createApiSupabaseClient();
    const bookingService = new ServerBookingService(supabase);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const booking = await bookingService.getBookingById(params.id);

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Booking fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch booking'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createApiSupabaseClient();
    const bookingService = new ServerBookingService(supabase);
    
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
    const { status, payment_status, code_verified, seats } = body;

    // Update booking
    const booking = await bookingService.updateBooking(params.id, {
      status,
      payment_status,
      code_verified,
      seats
    });

    return NextResponse.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Booking update error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update booking'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createApiSupabaseClient();
    const bookingService = new ServerBookingService(supabase);
    const notificationService = new ServerOneSignalNotificationService(supabase);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get booking details before cancellation for notifications
    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        *,
        ride:ride_id (
          *,
          driver:driver_id (
            id,
            full_name
          )
        ),
        user:user_id (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', params.id)
      .single();

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Cancel booking
    await bookingService.cancelBooking(params.id);

    // Send smart notifications after cancellation
    await Promise.all([
      // Send push notification to driver (availability changed)
      notificationService.sendDriverNotification(
        booking.ride.driver.id,
        'booking_cancelled',
        {
          id: booking.id,
          rideId: booking.ride.id,
          passengerName: booking.user.full_name,
          from: booking.ride.from_city,
          to: booking.ride.to_city,
          date: booking.ride.departure_time,
          seats: booking.seats,
          amount: booking.total_amount,
        }
      ).catch(err => {
        console.error('❌ Driver cancellation notification error (non-critical):', err);
      }),

      // Send SMS to passenger (confirmation)
      notificationService.sendCancellationConfirmationSMS(
        booking.user.phone,
        {
          id: booking.id,
          from: booking.ride.from_city,
          to: booking.ride.to_city,
          amount: booking.total_amount,
        }
      ).catch(err => {
        console.error('❌ Passenger cancellation SMS error (non-critical):', err);
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    console.error('Booking cancellation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cancel booking'
      },
      { status: 500 }
    );
  }
}