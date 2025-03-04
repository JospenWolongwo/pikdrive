import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/lib/payment/payment-service';
import crypto from 'crypto';

// Verify MTN MOMO webhook signature
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.MOMO_WEBHOOK_SECRET!;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const paymentService = new PaymentService(supabase);

    // Get signature from headers
    const signature = request.headers.get('x-signature');
    if (!signature) {
      console.error('❌ No signature provided');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Get and verify payload
    const payload = await request.text();
    if (!verifySignature(payload, signature)) {
      console.error('❌ Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook data
    const webhookData = JSON.parse(payload);
    console.log('📥 Received webhook:', webhookData);

    // Get transaction ID from reference
    const transactionId = request.headers.get('x-reference');
    if (!transactionId) {
      console.error('❌ No transaction ID provided');
      return NextResponse.json(
        { error: 'Missing transaction ID' },
        { status: 400 }
      );
    }

    // Get existing payment
    const payment = await paymentService.getPaymentByTransactionId(transactionId);
    if (!payment) {
      console.error('❌ Payment not found:', transactionId);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Update payment status based on webhook type
    switch (webhookData.type) {
      case 'payment.success':
        await paymentService.handlePaymentCallback(
          'mtn',
          {
            status: 'SUCCESSFUL',
            financialTransactionId: webhookData.data.financialTransactionId,
            transactionId
          }
        );
        break;

      case 'payment.failed':
        await paymentService.handlePaymentCallback(
          'mtn',
          {
            status: 'FAILED',
            reason: webhookData.data.reason,
            transactionId
          }
        );
        break;

      default:
        console.warn('⚠️ Unknown webhook type:', webhookData.type);
        return NextResponse.json(
          { error: 'Unknown webhook type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
