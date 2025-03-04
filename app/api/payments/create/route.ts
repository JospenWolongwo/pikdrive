import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const paymentService = new PaymentService(supabase);

    // Get request body
    const body = await request.json();
    const { bookingId, amount, provider, phoneNumber } = body;

    // Validate request
    if (!bookingId || !amount || !provider || !phoneNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create payment
    const result = await paymentService.createPayment({
      bookingId,
      amount,
      provider,
      phoneNumber
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Payment creation error:', error);
    
    // Check if error is a database error
    const dbError = error as any;
    if (dbError?.code) {
      console.error('Database error code:', dbError.code);
      console.error('Database error details:', dbError.details);
      console.error('Database error hint:', dbError.hint);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Payment creation failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
