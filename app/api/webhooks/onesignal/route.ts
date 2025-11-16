import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase with service role for webhook processing
    // This bypasses RLS policies that require service_role for inserts
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get raw body text for debugging
    const rawBody = await request.text();
    console.log('📡 OneSignal webhook raw body:', rawBody);

    // Parse JSON body
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Failed to parse webhook body as JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Extract webhook data with multiple fallback patterns
    // OneSignal webhook formats can vary by event type
    const eventType =
      body.type ||
      body.event ||
      body.event_type ||
      body.eventType ||
      'unknown';

    const notificationId =
      body.notification?.id ||
      body.notificationId ||
      body.notification_id ||
      body.notification?.notification_id ||
      null;

    const userId =
      body.notification?.external_user_id ||
      body.userId ||
      body.user_id ||
      body.external_user_id ||
      body.notification?.userId ||
      body.notification?.user_id ||
      null;

    console.log('📡 OneSignal webhook received:', {
      eventType,
      notificationId,
      userId,
      bodyKeys: Object.keys(body),
    });

    // Log webhook event for analytics
    // Use default event_type if none found to satisfy NOT NULL constraint
    const { error } = await supabase.from('onesignal_webhook_logs').insert({
      event_type: eventType || 'unknown',
      notification_id: notificationId || null,
      user_id: userId || null,
      data: body,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('❌ Webhook logging error:', error);
      // Don't fail the request if logging fails, but log the error
    } else {
      console.log('✅ Webhook logged successfully');
    }

    // Handle different event types
    switch (eventType) {
      case 'notification_sent':
      case 'notification.sent':
        console.log('📤 Notification sent successfully:', notificationId);
        break;
      case 'notification_clicked':
      case 'notification.clicked':
        console.log('👆 Notification clicked by user:', notificationId);
        // Optional: Track user engagement metrics
        break;
      case 'notification_failed':
      case 'notification.failed':
        console.log('❌ Notification failed to send:', notificationId);
        // Optional: Alert monitoring system or retry logic
        break;
      case 'notification_dismissed':
      case 'notification.dismissed':
        console.log('🚫 Notification dismissed by user:', notificationId);
        break;
      default:
        console.log('📋 Unknown webhook event type:', eventType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
