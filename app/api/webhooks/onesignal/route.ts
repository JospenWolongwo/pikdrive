import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const body = await request.json();

    console.log('📡 OneSignal webhook received:', {
      type: body.type,
      notificationId: body.notification?.id,
      userId: body.notification?.external_user_id,
    });

    // Log webhook event for analytics
    const { error } = await supabase
      .from('onesignal_webhook_logs')
      .insert({
        event_type: body.type,
        notification_id: body.notification?.id,
        user_id: body.notification?.external_user_id,
        data: body,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Webhook logging error:', error);
      // Don't fail the request if logging fails
    }

    // Handle different event types
    switch (body.type) {
      case 'notification_sent':
        console.log('📤 Notification sent successfully:', body.notification?.id);
        break;
      case 'notification_clicked':
        console.log('👆 Notification clicked by user:', body.notification?.id);
        // Optional: Track user engagement metrics
        break;
      case 'notification_failed':
        console.log('❌ Notification failed to send:', body.notification?.id);
        // Optional: Alert monitoring system or retry logic
        break;
      case 'notification_dismissed':
        console.log('🚫 Notification dismissed by user:', body.notification?.id);
        break;
      default:
        console.log('📋 Unknown webhook event type:', body.type);
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
