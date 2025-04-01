import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { bookingId, verificationCode } = body;

    if (!bookingId || !verificationCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if the booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, ride:ride_id(*)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Ensure user is the driver of the ride
    if (booking.ride.driver_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the driver can verify ride codes' },
        { status: 403 }
      );
    }

    // Verify the code using our database function
    const { data: isValid, error: verifyError } = await supabase.rpc(
      'verify_booking_code',
      { 
        booking_id: bookingId,
        submitted_code: verificationCode 
      }
    );

    if (verifyError) {
      console.error('Error verifying code:', verifyError);
      return NextResponse.json(
        { error: 'Failed to verify code' },
        { status: 500 }
      );
    }

    if (!isValid) {
      return NextResponse.json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Update booking status to confirmed if it was pending or pending_verification
    if (booking.status === 'pending' || booking.status === 'pending_verification') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (updateError) {
        console.error('Error updating booking status:', updateError);
        // Continue even if update fails, as the code verification was successful
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Verification successful'
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to verify code'
      },
      { status: 500 }
    );
  }
}
