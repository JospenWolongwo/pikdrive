import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SMSService } from '@/lib/notifications/sms-service';

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

    // Send SMS with the verification code if we have the phone number
    // Since we no longer directly join the user, we need to get phone separately
    try {
      // Get user's phone number from profiles table
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();
        
      const userPhone = userProfile?.phone;
      
      if (userPhone) {
        try {
          const smsService = new SMSService({
            accountSid: process.env.TWILIO_ACCOUNT_SID!,
            authToken: process.env.TWILIO_AUTH_TOKEN!,
            fromNumber: process.env.TWILIO_FROM_NUMBER!,
            environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox')
          });

          await smsService.sendMessage({
            to: userPhone,
            message: `Your PikDrive verification code is: ${codeData}. Show this to your driver to confirm your ride.`
          });
          
          console.log('✅ API: SMS sent to user with verification code');
        } catch (smsError) {
          console.error('⚠️ API: Error sending SMS:', smsError);
          // Continue even if SMS fails, as we'll show the code in the app
        }
      } else {
        console.log('ℹ️ API: User has no phone number, skipping SMS notification');
      }
    } catch (profileError) {
      console.error('⚠️ API: Error fetching user profile:', profileError);
      // Continue even if profile fetch fails
    }

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
