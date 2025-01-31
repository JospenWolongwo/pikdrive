'use client'

import { ThemeProvider } from 'next-themes'
import { SupabaseProvider } from './SupabaseProvider'
import { Toaster } from '@/components/ui/toaster'
import { Navbar } from '@/components/navbar'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SupabaseProvider>
        <div className="relative flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </SupabaseProvider>
    </ThemeProvider>
  )
}
