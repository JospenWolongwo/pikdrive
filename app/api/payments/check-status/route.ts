import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';

export async function POST(request: Request) {
  try {
    // Initialize Supabase client
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
    const { transactionId, provider } = body;

    if (!transactionId || !provider) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking payment status:', { transactionId, provider, userId: user.id });

    // Initialize payment service
    const paymentService = new PaymentService(supabase);

    // Check payment status
    const statusResult = await paymentService.checkPaymentStatus(transactionId, provider);
    
    console.log('✅ Payment status result:', statusResult);

    return NextResponse.json({
      success: statusResult.success,
      status: statusResult.status,
      message: statusResult.message
    });
  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check payment status',
        status: 'failed'
      },
      { status: 500 }
    );
  }
}
