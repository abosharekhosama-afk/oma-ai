'use client';

import { resolveLocale, t, type Locale } from '@oma/i18n';

export function getClientLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith('oma_locale='))
    ?.split('=')[1];
  return resolveLocale(raw ? decodeURIComponent(raw) : null);
}

export function useT(): (key: string) => string {
  const locale = getClientLocale();
  return (key: string) => t(locale, key);
}
