export type Locale = 'fr' | 'en';

export const locales: readonly Locale[] = ['fr', 'en'] as const;

export const defaultLocale: Locale = 'fr';

export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function getLocaleFromCookie(cookieValue: string | undefined): Locale {
  if (cookieValue && isValidLocale(cookieValue)) {
    return cookieValue;
  }
  return defaultLocale;
}

export function getLocaleFromStorage(storageValue: string | null): Locale {
  if (storageValue && isValidLocale(storageValue)) {
    return storageValue;
  }
  return defaultLocale;
}



