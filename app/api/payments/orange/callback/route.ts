import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // Initialize Supabase inside the handler
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Get callback data first
    const callbackData = await request.json();
    console.log('🟡 Orange Money callback received:', callbackData);

    // Extract key information
    const {
      status,
      transactionId,
      externalId,
      message,
      failureReason
    } = callbackData;

    if (!externalId && !transactionId) {
      console.error('❌ No payment reference in callback');
      return NextResponse.json(
        { error: 'Missing payment reference' },
        { status: 400 }
      );
    }

    // Debug: Try to find payment directly
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', externalId)
      .single();

    console.log('🔍 Direct payment lookup result:', { payment, error: fetchError });

    if (fetchError) {
      console.error('❌ Database error:', fetchError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!payment) {
      console.error('❌ Payment not found:', { externalId, transactionId });
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Use PaymentService with direct client
    const paymentService = new PaymentService(supabase);

    // Handle callback
    await paymentService.handlePaymentCallback(
      'orange',
      {
        status,
        reason: failureReason || message,
        transactionId,
        externalId
      }
    );

    return NextResponse.json({ 
      status: 'success',
      message: 'Payment callback processed successfully'
    });
  } catch (error) {
    console.error('❌ Error processing Orange Money callback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
