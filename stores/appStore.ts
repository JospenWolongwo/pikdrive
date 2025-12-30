import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getVersionedStorageKey } from "@/lib/storage-version";

interface AppState {
  // Global app state
  isLoading: boolean;
  notifications: any[];
  theme: string;
  offlineMode: boolean;
  lastSyncTime: number | null;

  // Actions
  setLoading: (loading: boolean) => void;
  setTheme: (theme: string) => void;
  setOfflineMode: (offline: boolean) => void;
  addNotification: (notification: any) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  updateLastSyncTime: (time: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      isLoading: false,
      notifications: [],
      theme: 'system',
      offlineMode: false,
      lastSyncTime: null,

      // Actions
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setTheme: (theme: string) => {
        set({ theme });
      },

      setOfflineMode: (offline: boolean) => {
        set({ offlineMode: offline });
      },

      addNotification: (notification: any) => {
        set((state) => ({
          notifications: [...state.notifications, notification],
        }));
      },

      removeNotification: (id: string) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      updateLastSyncTime: (time: number) => {
        set({ lastSyncTime: time });
      },
    }),
    {
      name: getVersionedStorageKey('app-storage'),
      // Only persist theme and lastSyncTime
      partialize: (state) => ({
        theme: state.theme,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);
