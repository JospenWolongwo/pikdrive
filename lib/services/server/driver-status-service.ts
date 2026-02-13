import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server-client';
import { updateDriverStatus } from '@/lib/driver-application-utils';
import { ServerMultiChannelNotificationService } from './multi-channel-notification-service';

/**
 * Change a driver's status ensuring the caller is an admin (uses an authenticated client)
 * and performs the actual update using the service-role client (bypasses RLS).
 */
export async function changeDriverStatusAsAdmin(
  authSupabase: SupabaseClient,
  driverId: string,
  status: 'approved' | 'rejected' | 'inactive'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check admin role
    const { data: profile, error: profileError } = await authSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return { success: false, error: 'Access denied. Admin role required.' };
    }

    // Create service role client for privileged updates
    let adminClient: SupabaseClient;
    try {
      adminClient = createServiceRoleClient();
    } catch (err) {
      console.error('[DRIVER STATUS SERVICE] Failed to create service role client:', err);
      return { success: false, error: 'Server configuration error' };
    }

    // Perform the status update
    const updateResult = await updateDriverStatus(adminClient, driverId, status);
    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to update driver status' };
    }

    // Notify driver (best-effort)
    try {
      const { data: driverProfile } = await adminClient
        .from('profiles')
        .select('full_name, phone')
        .eq('id', driverId)
        .single();

      const multiChannelService = new ServerMultiChannelNotificationService(adminClient);
      await multiChannelService.sendDriverApplicationStatusChanged({
        driverId,
        driverPhone: driverProfile?.phone || undefined,
        driverName: driverProfile?.full_name || 'Chauffeur',
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (notifyError) {
      console.error('[DRIVER STATUS SERVICE] Notification failed (non-blocking):', notifyError);
    }

    return { success: true };
  } catch (error) {
    console.error('[DRIVER STATUS SERVICE] Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
