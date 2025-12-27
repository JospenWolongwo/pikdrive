import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// This is a server-side API route for generating verification codes
export async function POST(request: Request) {
  try {
    console.log('🔄 API: Verification code generation request received');
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ API: User not authenticated');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      console.error('❌ API: Missing bookingId in request body');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log('🔍 API: Looking for booking with ID:', bookingId);
    console.log('👤 API: User ID:', user.id);

    // Check if the booking exists and belongs to the user
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, ride_id')
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      console.error('❌ API: Error fetching booking:', bookingError);
      return NextResponse.json(
        { error: 'Booking not found', details: bookingError.message },
        { status: 404 }
      );
    }
    
    if (!booking) {
      console.error('❌ API: No booking found with ID:', bookingId);
      
      // Additional check - try to find the booking without relations to debug
      const { data: simpleBooking } = await supabase
        .from('bookings')
        .select('id, user_id')
        .eq('id', bookingId)
        .single();
        
      if (simpleBooking) {
        console.log('⚠️ API: Found booking without relations:', simpleBooking);
      }
      
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    console.log('✅ API: Found booking:', { 
      id: booking.id, 
      user_id: booking.user_id,
      ride_id: booking.ride_id
    });

    // Ensure user owns the booking or is the driver of the ride
    const isOwner = booking.user_id === user.id;
    
    // If we need to check driver, we'd need a separate query
    let isDriver = false;
    if (!isOwner && booking.ride_id) {
      // Look up the ride to see if current user is the driver
      const { data: ride } = await supabase
        .from('rides')
        .select('driver_id')
        .eq('id', booking.ride_id)
        .single();
        
      isDriver = ride?.driver_id === user.id;
    }
    
    if (!isOwner && !isDriver) {
      console.log('🚫 API: Access denied. User is neither owner nor driver', {
        booking_user_id: booking.user_id,
        user_id: user.id,
        ride_driver_id: booking.ride_id
      });
      
      return NextResponse.json(
        { error: 'Not authorized to access this booking' },
        { status: 403 }
      );
    }

    // Generate verification code using our database function
    console.log('🔐 API: Generating verification code for booking:', bookingId);
    const { data: codeData, error: codeError } = await supabase.rpc(
      'generate_booking_verification_code',
      { booking_id: bookingId }
    );

    if (codeError) {
      console.error('❌ API: Error generating verification code:', codeError);
      return NextResponse.json(
        { error: 'Failed to generate verification code', details: codeError.message },
        { status: 500 }
      );
    }

    console.log('✅ API: Verification code generated:', codeData);

    // Note: SMS notifications are handled by OneSignal when payment completes
    // This endpoint only generates and returns the code for UI display

    return NextResponse.json({
      success: true,
      verificationCode: codeData
    });
  } catch (error) {
    console.error('❌ API: Verification code generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate verification code'
      },
      { status: 500 }
    );
  }
}
