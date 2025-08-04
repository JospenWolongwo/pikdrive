import { SupabaseClient } from '@supabase/supabase-js'

export interface DriverStatus {
  is_driver_applicant: boolean
  driver_application_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | null
  is_driver: boolean
  driver_status: 'pending' | 'approved' | 'rejected' | 'inactive' | null
  role: 'user' | 'driver' | 'admin'
}

/**
 * Gets the current driver status for a user
 */
export async function getDriverStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; data?: DriverStatus; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_driver_applicant, driver_application_status, is_driver, driver_status, role')
      .eq('id', userId)
      .single()

    if (error) {
      return {
        success: false,
        error: `Failed to fetch driver status: ${error.message}`
      }
    }

    return {
      success: true,
      data: data as DriverStatus
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Determines the appropriate route for driver actions based on status
 */
export function getDriverActionRoute(status: DriverStatus): {
  route: string
  message?: string
  action: 'redirect' | 'show_modal' | 'navigate'
} {
  // If user is already an approved driver
  if (status.is_driver && status.driver_status === 'approved') {
    return {
      route: '/driver/rides/new',
      action: 'redirect'
    }
  }

  // If user has never applied
  if (!status.is_driver_applicant) {
    return {
      route: '/become-driver',
      action: 'redirect'
    }
  }

  // If application is pending
  if (status.driver_application_status === 'pending') {
    return {
      route: '/driver/pending',
      action: 'redirect'
    }
  }

  // If application was rejected
  if (status.driver_application_status === 'rejected') {
    return {
      route: '/become-driver',
      message: 'Votre candidature précédente a été refusée. Vous pouvez postuler à nouveau.',
      action: 'redirect'
    }
  }

  // If application was cancelled
  if (status.driver_application_status === 'cancelled') {
    return {
      route: '/become-driver',
      message: 'Votre candidature précédente a été annulée. Vous pouvez postuler à nouveau.',
      action: 'redirect'
    }
  }

  // Default fallback
  return {
    route: '/become-driver',
    action: 'redirect'
  }
}

/**
 * Handles driver action routing with proper status checking
 */
export async function handleDriverAction(
  supabase: SupabaseClient,
  userId: string,
  router: any
): Promise<{ success: boolean; route: string; message?: string }> {
  try {
    const { success, data: status, error } = await getDriverStatus(supabase, userId)
    
    if (!success || !status) {
      return {
        success: false,
        route: '/become-driver',
        message: error || 'Impossible de vérifier votre statut de conducteur.'
      }
    }

    const { route, message, action } = getDriverActionRoute(status)

    if (action === 'redirect') {
      router.push(route)
    }

    return {
      success: true,
      route,
      message
    }
  } catch (error) {
    return {
      success: false,
      route: '/become-driver',
      message: 'Une erreur est survenue lors de la vérification de votre statut.'
    }
  }
} 