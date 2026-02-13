import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function useDriverStatus(supabase: SupabaseClient | null, userId?: string | null) {
  const [isApprovedDriver, setIsApprovedDriver] = useState(false)
  const [isStatusLoading, setIsStatusLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadDriverStatus = async () => {
      if (!supabase || !userId) {
        if (isMounted) {
          setIsApprovedDriver(false)
          setIsStatusLoading(false)
        }
        return
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('is_driver, driver_status')
          .eq('id', userId)
          .maybeSingle()

        const approved = Boolean(data?.is_driver) && data?.driver_status === 'approved'
        if (isMounted) {
          setIsApprovedDriver(approved)
        }
      } catch (error) {
        console.error('Failed to load driver status:', error)
        if (isMounted) {
          setIsApprovedDriver(false)
        }
      } finally {
        if (isMounted) {
          setIsStatusLoading(false)
        }
      }
    }

    loadDriverStatus()

    return () => {
      isMounted = false
    }
  }, [supabase, userId])

  return { isApprovedDriver, isStatusLoading }
}
