import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SMSService } from '@/lib/notifications/sms-service';

// Backup API endpoint that directly uses the RPC function for simplicity
export async function POST(request: Request) {
  try {
    console.log('🔄 API BACKUP: Direct code generation request received');
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ API BACKUP: User not authenticated');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      console.error('❌ API BACKUP: Missing bookingId in request body');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log('🔍 API BACKUP: Looking for booking with ID:', bookingId);
    console.log('👤 API BACKUP: User ID:', user.id);

    // Check if the booking exists - use a simplified query
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, user_id, ride_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ API BACKUP: Booking not found', bookingError);
      return NextResponse.json(
        { error: 'Booking not found', details: bookingError?.message },
        { status: 404 }
      );
    }
    
    console.log('✅ API BACKUP: Found booking:', booking);
    
    // Security check - user must own the booking or be the driver
    const isOwner = booking.user_id === user.id;
    
    // If checking for driver, we need a separate query
    let isDriver = false;
    if (!isOwner && booking.ride_id) {
      const { data: ride } = await supabase
        .from('rides')
        .select('driver_id')
        .eq('id', booking.ride_id)
        .single();
        
      isDriver = ride?.driver_id === user.id;
    }
    
    if (!isOwner && !isDriver) {
      console.error('🚫 API BACKUP: Access denied - user is not owner or driver');
      return NextResponse.json(
        { error: 'Not authorized to access this booking' },
        { status: 403 }
      );
    }

    // Direct database call using RPC function
    console.log('🔐 API BACKUP: Generating verification code');
    const { data: codeData, error: codeError } = await supabase.rpc(
      'generate_booking_verification_code',
      { booking_id: bookingId }
    );

    if (codeError) {
      console.error('❌ API BACKUP: RPC call failed:', codeError);
      return NextResponse.json(
        { error: 'Failed to generate verification code', details: codeError.message },
        { status: 500 }
      );
    }

    console.log('✅ API BACKUP: Verification code generated:', codeData);
    
    // Send SMS with the verification code if we have the phone number
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
          
          console.log('✅ API BACKUP: SMS sent to user with verification code');
        } catch (smsError) {
          console.error('⚠️ API BACKUP: Error sending SMS:', smsError);
          // Continue even if SMS fails, as we'll show the code in the app
        }
      } else {
        console.log('ℹ️ API BACKUP: User has no phone number, skipping SMS notification');
      }
    } catch (profileError) {
      console.error('⚠️ API BACKUP: Error fetching user profile:', profileError);
      // Continue even if profile fetch fails
    }

    return NextResponse.json({
      success: true,
      verificationCode: codeData,
      message: 'Code generated successfully via backup API'
    });

  } catch (error) {
    console.error('❌ API BACKUP: Error in code generator endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate verification code' 
      },
      { status: 500 }
    );
  }
}
