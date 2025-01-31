'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AuthState {
  user: any
  signIn: (phone: string) => Promise<{ error: string | null }>
  verifyOTP: (phone: string, token: string) => Promise<{ error: string | null; data: any }>
  signOut: () => Promise<void>
  getSession: () => Promise<void>
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      signIn: async (phone: string) => {
        try {
          console.log('Signing in with phone:', phone)
          const { error } = await supabase.auth.signInWithOtp({
            phone,
            options: {
              channel: 'sms',
            },
          })

          if (error) throw error
          console.log('OTP sent successfully')
          return { error: null }
        } catch (error: any) {
          console.error('Sign in error:', error)
          return { error: error.message }
        }
      },

      verifyOTP: async (phone: string, token: string) => {
        try {
          console.log('Verifying OTP for phone:', phone, 'token:', token)
          const { data, error } = await supabase.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
          })

          if (error) throw error

          console.log('OTP verification successful:', data)
          set({ user: data.user })
          return { error: null, data }
        } catch (error: any) {
          console.error('OTP verification error:', error)
          return { error: error.message, data: null }
        }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null })
      },

      getSession: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          set({ user: session.user })
        }
      },
    }),
    {
      name: 'auth-storage',
      skipHydration: true,
    }
  )
)

// Initialize session on app load
if (typeof window !== 'undefined') {
  useAuth.getState().getSession()

  // Set up auth state change listener
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session)
    if (session?.user) {
      useAuth.setState({ user: session.user })
    } else {
      useAuth.setState({ user: null })
    }
  })
}
