'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import type { Locale } from '@/i18n/config'
import { defaultLocale, getLocaleFromStorage, getLocaleFromCookie } from '@/i18n/config'

type LocaleProviderProps = {
  children: React.ReactNode
  defaultLocaleProp?: Locale
  initialMessages?: Record<string, any>
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

async function getMessages(locale: Locale) {
  try {
    return (await import(`@/messages/${locale}.json`)).default
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error)
    // Fallback to default locale messages
    if (locale !== defaultLocale) {
      try {
        return (await import(`@/messages/${defaultLocale}.json`)).default
      } catch (fallbackError) {
        console.error(`Failed to load fallback messages for locale: ${defaultLocale}`, fallbackError)
        return {}
      }
    }
    return {}
  }
}

export function LocaleProvider({
  children,
  defaultLocaleProp = defaultLocale,
  initialMessages,
  storageKey = 'ui-locale',
  ...props
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocaleProp)
  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<Record<string, any>>(initialMessages ?? {})
  const [loading, setLoading] = useState(!(initialMessages && Object.keys(initialMessages).length > 0))

  // Only access localStorage after component is mounted on client
  useEffect(() => {
    setMounted(true)
    
    // Try to get locale from localStorage first (user preference)
    const savedLocaleValue = typeof window !== 'undefined' 
      ? localStorage?.getItem(storageKey)
      : null
    
    const savedLocale = savedLocaleValue 
      ? getLocaleFromStorage(savedLocaleValue)
      : defaultLocale
    
    // Then try cookie (for SSR compatibility on first visit)
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
    
    // Use saved locale if localStorage has a value, otherwise use cookie, otherwise default
    const initialLocale = savedLocaleValue ? savedLocale : cookieLocale
    
    setLocaleState(initialLocale)
  }, [storageKey])

  // Load messages when locale changes
  useEffect(() => {
    if (!mounted) return
    
    setLoading(true)
    getMessages(locale)
      .then((loadedMessages) => {
        setMessages(loadedMessages)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading messages:', error)
        setLoading(false)
      })
  }, [locale, mounted])

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

  // Always provide NextIntlClientProvider.
  // With server-provided `initialMessages`, we avoid flashing translation keys on first paint.
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

