'use client';

import { resolveLocale, t, type Locale } from '@oma/i18n';
import { useLocale } from './locale-context';

/**
 * Only safe in event handlers. During render use {@link useLocale} so the
 * client agrees with the server-rendered markup.
 */
export function getClientLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith('oma_locale='))
    ?.split('=')[1];
  return resolveLocale(raw ? decodeURIComponent(raw) : null);
}

export function useT(): (key: string) => string {
  const locale = useLocale();
  return (key: string) => t(locale, key);
}

export { useLocale };
