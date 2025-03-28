import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // Initialize Supabase with service role for callback processing
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );
    
    const paymentService = new PaymentService(supabase);

    // Get the signature from headers
    const signature = request.headers.get('x-mtn-signature');
    console.log('🔐 MTN signature:', signature);
    
    // Get the callback payload
    const payload = await request.json();
    console.log('📦 MTN callback payload:', payload);

    // Validate and process the callback
    await paymentService.handlePaymentCallback('mtn', payload);
    console.log('✅ MTN callback processed successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ MTN MOMO callback error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Callback processing failed' 
      },
      { status: 400 }
    );
  }
}
