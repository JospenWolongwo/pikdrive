import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
    
    // Note: SMS notifications are handled by OneSignal when payment completes
    // This endpoint only generates and returns the code for UI display

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
