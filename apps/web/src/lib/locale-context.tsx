'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '@oma/i18n';

/**
 * The server resolves the locale from the cookie or Accept-Language header.
 * Client components must read that same value, otherwise the first client
 * render disagrees with the server markup and React discards it.
 */
export const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
