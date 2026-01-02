'use client'

import { useLocaleContext } from '@/providers/LocaleProvider'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/config'

export function useLocale() {
  const { locale, setLocale } = useLocaleContext()
  const t = useTranslations()

  return {
    locale,
    setLocale,
    t,
  }
}

export type { Locale }


