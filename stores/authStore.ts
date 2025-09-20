import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabaseClient } from "../lib/supabase-client";
import { zustandPersistConfig } from "../lib/supabase-config";

interface AuthState {
  user: any | null;
  signIn: (phone: string) => Promise<{ error: string | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: string | null; data: any | null }>;
  signOut: () => Promise<void>;
  getSession: () => Promise<void>;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      signIn: async (phone: string) => {
        try {
          const { error } = await supabaseClient.auth.signInWithOtp({
            phone,
            options: {
              channel: "sms",
            },
          });

          if (error) throw error;
          return { error: null };
        } catch (error: any) {
          console.error("Sign in error:", error);
          return { error: error.message };
        }
      },

      verifyOTP: async (phone: string, token: string) => {
        try {
          const { data, error } = await supabaseClient.auth.verifyOtp({
            phone,
            token,
            type: "sms",
          });

          if (error) throw error;

          set({ user: data.user });
          return { error: null, data };
        } catch (error: any) {
          console.error("OTP verification error:", error);
          return { error: error.message, data: null };
        }
      },

      signOut: async () => {
        await supabaseClient.auth.signOut();
        set({ user: null });
      },

      getSession: async () => {
        try {
          const {
            data: { session },
            error,
          } = await supabaseClient.auth.getSession();

          if (error) {
            console.error("Session error:", error);
            return;
          }

          if (session?.user) {
            set({ user: session.user });
          }
          // Don't clear user if no session - let it persist as fallback
        } catch (error) {
          console.error("Exception getting session:", error);
          // Don't clear user on error - let it persist as fallback
        }
      },

      clearUser: () => {
        set({ user: null });
      },
    }),
    zustandPersistConfig
  )
);

// Initialize session on app load
if (typeof window !== "undefined") {
  useAuthStore.getState().getSession();
}
