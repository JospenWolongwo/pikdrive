import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';

/**
 * Refund Callback Handler
 * Handles refund status updates from payment providers (MTN, Orange, pawaPay)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('💸 [REFUND CALLBACK] Received callback:', body);

    const { transaction_id, status, externalId } = body;

    // Use transaction_id or externalId depending on provider
    const refundTransactionId = transaction_id || externalId;

    if (!refundTransactionId) {
      console.error('❌ [REFUND CALLBACK] Missing transaction_id or externalId');
      return NextResponse.json(
        { success: false, error: 'Missing transaction identifier' },
        { status: 400 }
      );
    }

    const supabase = createApiSupabaseClient();

    // Find refund by transaction_id
    const { data: refund, error: findError } = await supabase
      .from('refunds')
      .select('*')
      .eq('transaction_id', refundTransactionId)
      .maybeSingle();

    if (findError) {
      console.error('❌ [REFUND CALLBACK] Error finding refund:', findError);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    if (!refund) {
      console.warn('⚠️ [REFUND CALLBACK] Refund not found for transaction:', refundTransactionId);
      return NextResponse.json(
        { success: false, error: 'Refund not found' },
        { status: 404 }
      );
    }

    // Map provider status to our status
    const mappedStatus = mapProviderStatusToPaymentStatus(status);

    console.log('💸 [REFUND CALLBACK] Updating refund status:', {
      refundId: refund.id,
      oldStatus: refund.status,
      newStatus: mappedStatus,
      providerStatus: status,
    });

    // Update refund status
    const { error: updateError } = await supabase
      .from('refunds')
      .update({ 
        status: mappedStatus, 
        updated_at: new Date().toISOString(),
        metadata: {
          ...refund.metadata,
          callbackReceived: true,
          callbackReceivedAt: new Date().toISOString(),
          providerStatus: status,
          callbackPayload: body,
        },
      })
      .eq('id', refund.id);

    if (updateError) {
      console.error('❌ [REFUND CALLBACK] Error updating refund:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update refund' },
        { status: 500 }
      );
    }

    console.log('✅ [REFUND CALLBACK] Refund status updated successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'Refund status updated successfully' 
    });
  } catch (error) {
    console.error('❌ [REFUND CALLBACK] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Map provider-specific status to our payment_status enum
 */
function mapProviderStatusToPaymentStatus(providerStatus: string): string {
  const status = providerStatus?.toUpperCase();

  // MTN MOMO statuses
  if (status === 'SUCCESSFUL') return 'completed';
  if (status === 'FAILED') return 'failed';
  if (status === 'PENDING') return 'processing';

  // Orange Money statuses (includes typos from their API)
  if (status === 'SUCCESSFULL') return 'completed'; // Orange typo
  if (status === 'FAIL') return 'failed';

  // pawaPay statuses
  if (status === 'COMPLETED') return 'completed';
  if (status === 'FAILURE') return 'failed';
  if (status === 'ACCEPTED' || status === 'SUBMITTED') return 'processing';

  // Default to processing for unknown statuses
  console.warn('⚠️ [REFUND CALLBACK] Unknown provider status:', providerStatus);
  return 'processing';
}
