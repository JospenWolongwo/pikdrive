'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { SupabaseProvider } from '@/providers/SupabaseProvider'
import { Toaster } from '@/components/ui/toaster'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster />
      </NextThemesProvider>
    </SupabaseProvider>
  )
}
