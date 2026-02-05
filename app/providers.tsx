'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { Toaster as SonnerToaster } from 'sonner'
import { Toaster } from '@/components/ui'
import { LocaleProvider } from '@/providers/LocaleProvider'
import type { Locale } from '@/i18n/config'

type ProvidersProps = {
  children: React.ReactNode
  initialLocale?: Locale
  initialMessages?: Record<string, any>
}

export function Providers({ children, initialLocale, initialMessages }: ProvidersProps) {
  return (
    <LocaleProvider defaultLocaleProp={initialLocale} initialMessages={initialMessages}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </NextThemesProvider>
    </LocaleProvider>
  )
}
