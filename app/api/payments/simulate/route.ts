import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerPaymentService } from '@/lib/services/server/payment-service';
import { ServerPaymentOrchestrationService } from '@/lib/services/server/payment-orchestration-service';

/**
 * Payment Simulation API
 * 
 * FOR TESTING/DEVELOPMENT ONLY
 * Simulates payment status transitions without requiring actual provider API calls
 * 
 * Usage:
 * POST /api/payments/simulate
 * {
 *   "transactionId": "abc-123",
 *   "newStatus": "completed" | "failed" | "processing"
 * }
 */
export async function POST(request: NextRequest) {
  // Only allow in development/sandbox
  if (process.env.NODE_ENV === 'production' && process.env.MOMO_TARGET_ENVIRONMENT !== 'sandbox') {
    return NextResponse.json(
      { success: false, error: 'Simulation endpoint not available in production' },
      { status: 403 }
    );
  }

  try {
    const supabase = createApiSupabaseClient();
    const paymentService = new ServerPaymentService(supabase);
    const orchestrationService = new ServerPaymentOrchestrationService(supabase);

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactionId, paymentId, newStatus } = body;

    if ((!transactionId && !paymentId) || !newStatus) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: (transactionId or paymentId) and newStatus' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('🧪 [SIMULATE] Payment status simulation:', { transactionId, paymentId, newStatus });

    // Find payment
    let payment = null;
    if (transactionId) {
      payment = await paymentService.getPaymentByTransactionId(transactionId);
    } else if (paymentId) {
      payment = await paymentService.getPaymentById(paymentId);
    }

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    console.log('🧪 [SIMULATE] Found payment:', {
      id: payment.id,
      currentStatus: payment.status,
      targetStatus: newStatus,
    });

    // Validate state transition
    if (!paymentService.validateStateTransition(payment.status, newStatus)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid state transition: ${payment.status} → ${newStatus}`,
          currentStatus: payment.status,
        },
        { status: 400 }
      );
    }

    // Update payment status
    await orchestrationService.handlePaymentStatusChange(payment, newStatus, {
      provider_response: {
        simulated: true,
        timestamp: new Date().toISOString(),
      },
    });

    console.log('✅ [SIMULATE] Payment status updated successfully');

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.id,
        transactionId: payment.transaction_id,
        bookingId: payment.booking_id,
        oldStatus: payment.status,
        newStatus: newStatus,
        message: `Payment status simulated: ${payment.status} → ${newStatus}`,
      },
    });
  } catch (error) {
    console.error('❌ [SIMULATE] Simulation error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Simulation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - Show simulation instructions
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.MOMO_TARGET_ENVIRONMENT !== 'sandbox') {
    return NextResponse.json(
      { error: 'Simulation endpoint not available in production' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    title: 'Payment Simulation API',
    description: 'Simulate payment status transitions for testing',
    usage: {
      endpoint: '/api/payments/simulate',
      method: 'POST',
      body: {
        transactionId: 'string (optional if paymentId provided)',
        paymentId: 'string (optional if transactionId provided)',
        newStatus: 'pending | processing | completed | failed | cancelled | refunded',
      },
      example: {
        transactionId: 'abc-123-def-456',
        newStatus: 'completed',
      },
    },
    validTransitions: {
      pending: ['processing', 'failed', 'cancelled'],
      processing: ['completed', 'failed'],
      completed: ['refunded'],
      failed: [],
      cancelled: [],
      refunded: [],
    },
  });
}

