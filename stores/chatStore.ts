import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UnreadCount {
  rideId: string;
  count: number;
}

interface ChatState {
  unreadCounts: UnreadCount[];
  activeConversations: Set<string>;
  subscribedRides: Set<string>;

  // Actions
  markAsRead: (rideId: string) => Promise<void>;
  subscribeToRide: (rideId: string) => void;
  unsubscribeFromRide: (rideId: string) => void;
  updateUnreadCount: (rideId: string, count: number) => void;
  addUnreadCount: (rideId: string) => void;
  clearUnreadCount: (rideId: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      unreadCounts: [],
      activeConversations: new Set(),
      subscribedRides: new Set(),

      // Actions
      markAsRead: async (rideId: string) => {
        // This will be implemented when we migrate the ChatProvider
        set((state) => ({
          unreadCounts: state.unreadCounts.filter((count) => count.rideId !== rideId),
        }));
      },

      subscribeToRide: (rideId: string) => {
        set((state) => ({
          subscribedRides: new Set([...state.subscribedRides, rideId]),
        }));
      },

      unsubscribeFromRide: (rideId: string) => {
        set((state) => {
          const newSubscribedRides = new Set(state.subscribedRides);
          newSubscribedRides.delete(rideId);
          return { subscribedRides: newSubscribedRides };
        });
      },

      updateUnreadCount: (rideId: string, count: number) => {
        set((state) => {
          const existingIndex = state.unreadCounts.findIndex(
            (item) => item.rideId === rideId
          );

          if (existingIndex >= 0) {
            // Update existing count
            const newUnreadCounts = [...state.unreadCounts];
            newUnreadCounts[existingIndex] = { rideId, count };
            return { unreadCounts: newUnreadCounts };
          } else {
            // Add new count
            return {
              unreadCounts: [...state.unreadCounts, { rideId, count }],
            };
          }
        });
      },

      addUnreadCount: (rideId: string) => {
        const { unreadCounts } = get();
        const existing = unreadCounts.find((item) => item.rideId === rideId);
        
        if (existing) {
          get().updateUnreadCount(rideId, existing.count + 1);
        } else {
          get().updateUnreadCount(rideId, 1);
        }
      },

      clearUnreadCount: (rideId: string) => {
        set((state) => ({
          unreadCounts: state.unreadCounts.filter((item) => item.rideId !== rideId),
        }));
      },
    }),
    {
      name: 'chat-storage',
      // Only persist unreadCounts, not the Sets
      partialize: (state) => ({
        unreadCounts: state.unreadCounts,
      }),
    }
  )
);
