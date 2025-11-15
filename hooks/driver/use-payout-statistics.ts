import { useEffect, useMemo } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { usePayoutsStore } from '@/stores/payoutsStore';
import type { PayoutWithDetails, PayoutStatistics } from '@/types/payout';

interface UsePayoutStatisticsOptions {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'all';
  limit?: number;
  offset?: number;
}

interface UsePayoutStatisticsReturn {
  payouts: PayoutWithDetails[];
  statistics: PayoutStatistics;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export function usePayoutStatistics(
  options: UsePayoutStatisticsOptions = {}
): UsePayoutStatisticsReturn {
  const { user, supabase } = useSupabase();
  
  // Get data from Zustand store
  const allPayouts = usePayoutsStore((state) => state.allPayouts);
  const statistics = usePayoutsStore((state) => state.statistics);
  const loading = usePayoutsStore((state) => state.loading);
  const error = usePayoutsStore((state) => state.error);
  const fetchPayouts = usePayoutsStore((state) => state.fetchPayouts);
  const refreshPayouts = usePayoutsStore((state) => state.refreshPayouts);
  const getFilteredPayouts = usePayoutsStore((state) => state.getFilteredPayouts);
  const subscribeToPayoutUpdates = usePayoutsStore((state) => state.subscribeToPayoutUpdates);
  const unsubscribeFromPayoutUpdates = usePayoutsStore((state) => state.unsubscribeFromPayoutUpdates);

  // Filter payouts client-side based on status
  const filteredPayouts = useMemo(() => {
    const filtered = getFilteredPayouts(options.status);
    
    // Apply pagination if needed
    if (options.limit || options.offset) {
      const start = options.offset || 0;
      const end = start + (options.limit || filtered.length);
      return filtered.slice(start, end);
    }
    
    return filtered;
  }, [getFilteredPayouts, options.status, options.limit, options.offset]);

  // Initial fetch on mount
  useEffect(() => {
    if (user) {
      fetchPayouts();
    }
  }, [user, fetchPayouts]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !supabase) return;

    subscribeToPayoutUpdates(supabase, user.id);

    return () => {
      unsubscribeFromPayoutUpdates(supabase);
    };
  }, [user, supabase, subscribeToPayoutUpdates, unsubscribeFromPayoutUpdates]);

  return {
    payouts: filteredPayouts,
    statistics,
    loading,
    error,
    refresh: refreshPayouts,
    pagination: {
      limit: options.limit || filteredPayouts.length,
      offset: options.offset || 0,
      total: allPayouts.length,
    },
  };
}

