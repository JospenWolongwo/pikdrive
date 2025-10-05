import { create } from "zustand";
import { supabaseClient } from "../lib/supabase-client";

// Simplified auth store - NO PERSISTENCE
// Authentication state is managed entirely by Supabase cookies
interface AuthState {
  signIn: (phone: string) => Promise<{ error: string | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: string | null; data: any | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
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

      // No need to set user in zustand - Supabase handles it via cookies
      return { error: null, data };
    } catch (error: any) {
      console.error("OTP verification error:", error);
      return { error: error.message, data: null };
    }
  },

  signOut: async () => {
    await supabaseClient.auth.signOut();
    // No need to clear user - Supabase handles it
  },
}));
