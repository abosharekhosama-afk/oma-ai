import en from '../messages/en.json';
import ar from '../messages/ar.json';

export type Locale = 'en' | 'ar';

const catalogs: Record<Locale, Record<string, string>> = { en, ar };

export function resolveLocale(input?: string | null): Locale {
  if (!input) return 'en';
  return input.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function resolveDir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function t(locale: Locale, key: string): string {
  return catalogs[locale][key] ?? catalogs.en[key] ?? key;
}
