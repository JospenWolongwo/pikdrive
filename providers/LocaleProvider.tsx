'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import type { Locale } from '@/i18n/config'
import { defaultLocale, getLocaleFromStorage, getLocaleFromCookie } from '@/i18n/config'

// CRITICAL FIX: Pre-load messages at build time to avoid dynamic import failures in PWA
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'

const messagesMap: Record<Locale, Record<string, any>> = {
  en: enMessages,
  fr: frMessages,
}

type LocaleProviderProps = {
  children: React.ReactNode
  defaultLocaleProp?: Locale
  storageKey?: string
}

type LocaleProviderState = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const initialState: LocaleProviderState = {
  locale: defaultLocale,
  setLocale: () => null,
}

const LocaleProviderContext = createContext<LocaleProviderState>(initialState)

export function LocaleProvider({
  children,
  defaultLocaleProp = defaultLocale,
  storageKey = 'ui-locale',
  ...props
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocaleProp)
  const [mounted, setMounted] = useState(false)

  // CRITICAL FIX: Use pre-loaded messages instead of dynamic imports
  // This prevents PWA caching issues and ensures messages are always available
  const messages = useMemo(() => {
    return messagesMap[locale] || messagesMap[defaultLocale]
  }, [locale])

  // Only access localStorage after component is mounted on client
  useEffect(() => {
    setMounted(true)
    
    // CRITICAL FIX: Use cookie first (matches server), then localStorage
    // This prevents hydration mismatches between server and client
    let cookieLocale = defaultLocale
    if (typeof document !== 'undefined') {
      const cookieValue = document.cookie
        .split(';')
        .find(c => c.trim().startsWith('locale='))
        ?.split('=')[1]
        ?.trim()
      if (cookieValue) {
        cookieLocale = getLocaleFromCookie(cookieValue)
      }
    }
    
    // Try to get locale from localStorage (user preference)
    const savedLocaleValue = typeof window !== 'undefined' 
      ? localStorage?.getItem(storageKey)
      : null
    
    const savedLocale = savedLocaleValue 
      ? getLocaleFromStorage(savedLocaleValue)
      : cookieLocale
    
    // Use cookie locale first to match server, then localStorage
    const initialLocale = cookieLocale || savedLocale
    
    setLocaleState(initialLocale)
  }, [storageKey])

  // Update document language attribute and cookie when locale changes
  useEffect(() => {
    if (!mounted) return

    // Update HTML lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
      
      // Update cookie for SSR compatibility
      document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
    }
  }, [locale, mounted])

  const setLocale = (newLocale: Locale) => {
    if (typeof window !== 'undefined') {
      localStorage?.setItem(storageKey, newLocale)
      // Update cookie as well
      document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
    }
    setLocaleState(newLocale)
  }

  const value = {
    locale,
    setLocale,
  }

  // CRITICAL FIX: Always provide messages (no loading state needed)
  // Messages are pre-loaded, so no async loading required
  return (
    <LocaleProviderContext.Provider value={value} {...props}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleProviderContext.Provider>
  )
}

export const useLocaleContext = () => {
  const context = useContext(LocaleProviderContext)

  if (context === undefined)
    throw new Error('useLocaleContext must be used within a LocaleProvider')

  return context
}

