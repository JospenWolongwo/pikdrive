import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server-client';
import { ServerMultiChannelNotificationService } from './multi-channel-notification-service';

/**
 * Notify all admins about a driver application submission.
 * Performs auth checks using the provided authenticated Supabase client
 * and performs notifications using the service-role client.
 */
export async function notifyAdminsForDriverApplication(
  authSupabase: SupabaseClient,
  driverId: string,
  submittedAt?: string
): Promise<{ success: boolean; notified?: number; error?: string; status?: number }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Unauthorized', status: 401 };
    }

    if (!driverId || driverId !== user.id) {
      return { success: false, error: 'Invalid driverId', status: 400 };
    }

    const adminClient = createServiceRoleClient();

    const { data: applicant, error: applicantError } = await adminClient
      .from('profiles')
      .select('id, full_name, city')
      .eq('id', driverId)
      .single();

    if (applicantError || !applicant) {
      return { success: false, error: 'Applicant profile not found', status: 404 };
    }

    const { data: admins, error: adminsError } = await adminClient
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'admin');

    if (adminsError) {
      return { success: false, error: 'Failed to load admins', status: 500 };
    }

    if (!admins || admins.length === 0) {
      return { success: true, notified: 0 };
    }

    const multiChannelService = new ServerMultiChannelNotificationService(adminClient);
    const sentAt = submittedAt || new Date().toISOString();

    const results = await Promise.allSettled(
      admins.map((admin) =>
        multiChannelService.sendAdminDriverApplicationSubmitted({
          adminId: admin.id,
          adminPhone: admin.phone || undefined,
          adminName: admin.full_name || 'Admin',
          applicantName: applicant.full_name || 'Nouveau candidat',
          applicantCity: applicant.city || undefined,
          submittedAt: sentAt,
          applicantId: applicant.id,
        })
      )
    );

    const notified = results.filter((r) => r.status === 'fulfilled').length;
    return { success: true, notified };
  } catch (error) {
    console.error('[NOTIFY SERVICE] Error notifying admins for driver application:', error);
    return { success: false, error: 'Internal server error', status: 500 };
  }
}
