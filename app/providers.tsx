'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { Toaster } from 'sonner'
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
        <Toaster richColors position="top-right" />
      </NextThemesProvider>
    </LocaleProvider>
  )
}
