import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { resolveDir, resolveLocale, t, type Locale } from '@oma/i18n';
import { LocaleProvider } from '../lib/locale-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'OMA AI',
  description: 'OMA AI by IMKAN',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('oma_locale')?.value;
  const locale: Locale = resolveLocale(localeCookie ?? hdrs.get('accept-language'));
  const dir = resolveDir(locale);
  return (
    <html lang={locale} dir={dir}>
      <body>
        <a href="#main" className="oma-skip-link">
          {t(locale, 'shell.skip')}
        </a>
        <LocaleProvider locale={locale}>
          <div data-endorsement={t(locale, 'app.endorsement')}>{children}</div>
        </LocaleProvider>
      </body>
    </html>
  );
}
