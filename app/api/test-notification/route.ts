import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import { ServerOneSignalNotificationService } from '@/lib/services/server/onesignal-notification-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    
    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: sessionError?.message },
        { status: 401 }
      );
    }

    const user = session.user;

    // Test notification service
    const notificationService = new ServerOneSignalNotificationService(supabase);
    
    console.log('🧪 Testing notification for user:', user.id);

    const result = await notificationService.sendNotification({
      userId: user.id,
      title: 'Test Notification',
      message: 'This is a test notification to verify the system is working!',
      notificationType: 'test',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        icon: 'Bell',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Test notification sent',
      result,
    });
  } catch (error) {
    console.error('❌ Test notification error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Test notification failed',
      },
      { status: 500 }
    );
  }
}


