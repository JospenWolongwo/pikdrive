import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ServerPawaPayCallbackService } from '@/lib/services/server';
import { HTTP_CODE } from '@/types/payment-ext';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * pawaPay Callback Handler
 * Handles webhooks from pawaPay for both deposits and payouts
 * PRIMARY mechanism for real-time status updates
 */
export async function POST(request: NextRequest) {
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
    
    const callbackService = new ServerPawaPayCallbackService(supabase);

    // Get callback payload
    const callback = await request.json();
    console.log('[CALLBACK] pawaPay callback received:', callback);

    const result = await callbackService.handleCallback(callback);

    // Always return 200 OK immediately to acknowledge receipt
    // This prevents pawaPay from retrying
    return NextResponse.json({ message: result.message }, { status: HTTP_CODE.OK });
  } catch (error) {
    console.error('[CALLBACK] pawaPay callback error:', error);
    // Return 200 to prevent retries on our errors
    return NextResponse.json(
      { message: 'Callback received' },
      { status: HTTP_CODE.OK }
    );
  }
}

