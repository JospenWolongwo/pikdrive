import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayoutWithDetails, PayoutStatistics } from "@/types/payout";
import { createPersistConfig, CACHE_LIMITS, trimArray } from "@/lib/storage";

interface PayoutsState {
  // All payouts state
  allPayouts: PayoutWithDetails[];
  statistics: PayoutStatistics;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  realTimeChannel: any | null;

  // Actions
  fetchPayouts: (forceRefresh?: boolean) => Promise<void>;
  refreshPayouts: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearPayouts: () => void;
  subscribeToPayoutUpdates: (supabase: SupabaseClient, userId: string) => void;
  unsubscribeFromPayoutUpdates: (supabase: SupabaseClient) => void;
  
  // Computed getters (client-side filtering)
  getFilteredPayouts: (status?: 'pending' | 'processing' | 'completed' | 'failed' | 'all') => PayoutWithDetails[];
  getStatistics: () => PayoutStatistics;
}

type PayoutsPersistedState = Pick<
  PayoutsState,
  "allPayouts" | "statistics" | "lastFetch"
>;

// Calculate statistics from payouts array
function calculateStatistics(payouts: PayoutWithDetails[]): PayoutStatistics {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalEarnings = 0;
  let pendingAmount = 0;
  let processingAmount = 0;
  let completedCount = 0;
  let completedAmount = 0;
  let failedCount = 0;
  let thisMonthEarnings = 0;

  payouts.forEach((payout) => {
    const amount = parseFloat(payout.amount.toString());
    const payoutDate = new Date(payout.created_at);

    if (payout.status === 'completed') {
      completedCount++;
      completedAmount += amount;
      totalEarnings += amount;

      if (payoutDate >= startOfMonth) {
        thisMonthEarnings += amount;
      }
    } else if (payout.status === 'pending') {
      pendingAmount += amount;
    } else if (payout.status === 'processing') {
      processingAmount += amount;
    } else if (payout.status === 'failed') {
      failedCount++;
    }
  });

  return {
    totalEarnings,
    pendingAmount,
    processingAmount,
    completedCount,
    completedAmount,
    failedCount,
    thisMonthEarnings,
    totalCount: payouts.length,
  };
}

export const usePayoutsStore = create<PayoutsState>()(
  persist(
    (set, get) => ({
      // Initial state
      allPayouts: [],
      statistics: {
        totalEarnings: 0,
        pendingAmount: 0,
        processingAmount: 0,
        completedCount: 0,
        completedAmount: 0,
        failedCount: 0,
        thisMonthEarnings: 0,
        totalCount: 0,
      },
      loading: false,
      error: null,
      lastFetch: null,
      realTimeChannel: null,

      // Fetch all payouts (no filters - we filter client-side)
      fetchPayouts: async (forceRefresh = false) => {
        const { lastFetch } = get();
        const now = Date.now();

        // Check cache (5 minutes cache) unless force refresh
        if (!forceRefresh && lastFetch && now - lastFetch < 5 * 60 * 1000) {
          return;
        }

        set({ loading: true, error: null });

        try {
          // Fetch all payouts without status filter
          const response = await fetch('/api/driver/payouts?limit=1000');
          
          if (!response.ok) {
            throw new Error(`Failed to fetch payouts: ${response.statusText}`);
          }

          const data = await response.json();
          const payouts = data.payouts || [];
          
          // Calculate statistics from fetched data
          const statistics = calculateStatistics(payouts);

          set({
            allPayouts: payouts,
            statistics,
            loading: false,
            error: null,
            lastFetch: now,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch payouts';
          set({
            loading: false,
            error: errorMessage,
          });
        }
      },

      refreshPayouts: async () => {
        // Force refresh by clearing cache
        set({ lastFetch: null });
        await get().fetchPayouts(true);
      },

      setLoading: (loading) => {
        set({ loading });
      },

      setError: (error) => {
        set({ error });
      },

      clearPayouts: () => {
        set({
          allPayouts: [],
          statistics: {
            totalEarnings: 0,
            pendingAmount: 0,
            processingAmount: 0,
            completedCount: 0,
            completedAmount: 0,
            failedCount: 0,
            thisMonthEarnings: 0,
            totalCount: 0,
          },
          error: null,
          lastFetch: null,
        });
      },

      // Client-side filtering
      getFilteredPayouts: (status?: 'pending' | 'processing' | 'completed' | 'failed' | 'all') => {
        const { allPayouts } = get();
        if (!status || status === 'all') {
          return allPayouts;
        }
        return allPayouts.filter((payout) => payout.status === status);
      },

      // Get current statistics (recalculated from cached data)
      getStatistics: () => {
        const { allPayouts } = get();
        return calculateStatistics(allPayouts);
      },

      // Subscribe to real-time payout updates
      subscribeToPayoutUpdates: (supabase: SupabaseClient, userId: string) => {
        const { realTimeChannel } = get();

        // Unsubscribe from existing channel if any
        if (realTimeChannel) {
          supabase.removeChannel(realTimeChannel);
        }

        const channel = supabase
          .channel('driver-payouts-updates')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'payouts',
              filter: `driver_id=eq.${userId}`,
            },
            async (payload) => {
              // Update the specific payout in the array
              set((state) => {
                let updatedPayouts = [...state.allPayouts];

                if (payload.eventType === 'INSERT') {
                  // FIX: For INSERT, add payout immediately but trigger fetch to get full data with relations
                  const newPayout = payload.new as PayoutWithDetails;
                  
                  // Check if payout already exists (avoid duplicates)
                  const exists = updatedPayouts.some(p => p.id === newPayout.id);
                  if (!exists) {
                    // Add new payout at the beginning (most recent first)
                    updatedPayouts = [newPayout, ...updatedPayouts];
                  }
                  
                  // Trigger a refresh to get full payout data with booking/ride relations
                  // Use setTimeout to avoid blocking the current state update
                  setTimeout(() => {
                    get().fetchPayouts(true);
                  }, 100);
                } else if (payload.eventType === 'UPDATE') {
                  // Update existing payout - merge to preserve existing relations if payload.new doesn't have them
                  updatedPayouts = updatedPayouts.map((payout) => {
                    if (payout.id === payload.new.id) {
                      // Merge new data with existing payout to preserve relations
                      return {
                        ...payout,
                        ...(payload.new as PayoutWithDetails),
                        // Preserve booking/ride if not in payload.new (real-time updates may not include relations)
                        booking: (payload.new as PayoutWithDetails).booking || payout.booking,
                      } as PayoutWithDetails;
                    }
                    return payout;
                  });
                  
                  // If payout wasn't found, add it (shouldn't happen but handle edge case)
                  const found = updatedPayouts.some(p => p.id === payload.new.id);
                  if (!found) {
                    updatedPayouts = [payload.new as PayoutWithDetails, ...updatedPayouts];
                  }
                } else if (payload.eventType === 'DELETE') {
                  // Remove deleted payout
                  updatedPayouts = updatedPayouts.filter(
                    (payout) => payout.id !== payload.old.id
                  );
                }

                // Recalculate statistics
                const statistics = calculateStatistics(updatedPayouts);

                return {
                  allPayouts: updatedPayouts,
                  statistics,
                  lastFetch: Date.now(), // Mark as fresh
                };
              });
            }
          )
          .subscribe();

        set({ realTimeChannel: channel });
      },

      // Unsubscribe from real-time updates
      unsubscribeFromPayoutUpdates: (supabase: SupabaseClient) => {
        const { realTimeChannel } = get();

        if (realTimeChannel) {
          supabase.removeChannel(realTimeChannel);
          set({ realTimeChannel: null });
        }
      },
    }),
    createPersistConfig<PayoutsState, PayoutsPersistedState>("payouts-storage", {
      // Persist data only; trim to keep storage bounded
      partialize: (state) => {
        const trimmedPayouts = trimArray(state.allPayouts, CACHE_LIMITS.payouts);
        return {
          allPayouts: trimmedPayouts,
          statistics: calculateStatistics(trimmedPayouts),
          lastFetch: state.lastFetch,
        };
      },
    })
  )
);

