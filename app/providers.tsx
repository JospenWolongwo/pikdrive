'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { LocaleProvider } from '@/providers/LocaleProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster richColors position="top-right" />
      </NextThemesProvider>
    </LocaleProvider>
  )
}
