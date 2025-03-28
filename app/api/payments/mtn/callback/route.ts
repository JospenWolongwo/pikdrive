import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const paymentService = new PaymentService(supabase);

    // Get the signature from headers
    const signature = request.headers.get('x-mtn-signature');
    
    // Get the callback payload
    const payload = await request.json();

    // Validate and process the callback
    await paymentService.handlePaymentCallback('mtn', payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('MTN MOMO callback error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Callback processing failed' 
      },
      { status: 400 }
    );
  }
}
