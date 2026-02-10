/**
 * Server-side translation utility
 * Provides translations for server-side code (API routes, services)
 */

import { enMessages, frMessages } from '@/messages';

type Locale = 'en' | 'fr';

const messages: Record<Locale, any> = {
  en: enMessages,
  fr: frMessages,
};

/**
 * Get translated string with parameter replacement
 * @param locale - Language locale ('en' or 'fr')
 * @param key - Translation key (e.g., 'notifications.bookingCancelled.title')
 * @param params - Optional parameters to replace in the string (e.g., {amount: 1000, phone: '237...'})
 * @returns Translated string with parameters replaced
 */
export function getTranslation(
  locale: Locale = 'fr',
  key: string,
  params?: Record<string, string | number>
): string {
  const keys = key.split('.');
  let value: any = messages[locale];

  // Navigate through the nested object
  for (const k of keys) {
    value = value?.[k];
  }

  // If translation not found, return the key
  if (typeof value !== 'string') {
    console.warn(`Translation key not found: ${key} for locale: ${locale}`);
    return key;
  }

  // Replace parameters in the string (e.g., {amount} -> 1000)
  if (params) {
    return Object.entries(params).reduce(
      (str, [param, val]) => str.replace(new RegExp(`\\{${param}\\}`, 'g'), String(val)),
      value
    );
  }

  return value;
}

/**
 * Format amount for display (used in translations)
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount);
}
