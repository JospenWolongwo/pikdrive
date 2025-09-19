import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createBrowserClient } from "@supabase/ssr";
import {
  ssrSupabaseConfig,
  zustandPersistConfig,
} from "../lib/supabase-config";

const supabase = createBrowserClient(
  ssrSupabaseConfig.supabaseUrl,
  ssrSupabaseConfig.supabaseKey,
  {
    auth: ssrSupabaseConfig.auth,
    cookies: ssrSupabaseConfig.cookies,
  }
);

interface AuthState {
  user: any | null;
  signIn: (phone: string) => Promise<{ error: string | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: string | null; data: any | null }>;
  signOut: () => Promise<void>;
  getSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      signIn: async (phone: string) => {
        try {
          const { error } = await supabase.auth.signInWithOtp({
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
          const { data, error } = await supabase.auth.verifyOtp({
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
        await supabase.auth.signOut();
        set({ user: null });
      },

      getSession: async () => {
        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            console.error("Session error:", error);
            return;
          }

          if (session?.user) {
            set({ user: session.user });
          }
        } catch (error) {
          console.error("Exception getting session:", error);
        }
      },
    }),
    zustandPersistConfig
  )
);

// Initialize session on app load
if (typeof window !== "undefined") {
  useAuthStore.getState().getSession();
}
