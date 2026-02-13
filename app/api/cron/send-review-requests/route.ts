import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ServerReviewRequestService } from '@/lib/services/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * GET /api/cron/send-review-requests
 * Cron job to send review requests for eligible bookings
 * Should be called hourly via Vercel Cron
 */
export async function GET(request: Request) {
  try {
    // Validate required environment variables
    const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);
    
    if (missingEnv.length > 0) {
      console.error('❌ Cron env validation failed:', { missingEnv });
      return NextResponse.json(
        { error: 'Missing required environment variables', missingEnv },
        { status: 500 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    console.log('[CRON] Starting review request job...');

    // Run review request service
    const reviewRequestService = new ServerReviewRequestService(supabase);
    const result = await reviewRequestService.sendReviewRequests();

    console.log('[CRON] Review request job completed:', result);

    return NextResponse.json({
      success: result.success,
      data: {
        passengerRequestsSent: result.passengerRequestsSent,
        driverRequestsSent: result.driverRequestsSent,
        totalSent: result.passengerRequestsSent + result.driverRequestsSent,
        errors: result.errors,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send review requests',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
