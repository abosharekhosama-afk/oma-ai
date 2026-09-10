import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_Arabic } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { resolveDir, resolveLocale, t, type Locale } from '@oma/i18n';
import { LocaleProvider } from '../lib/locale-context';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-arabic',
  display: 'swap',
});

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
    <html
      lang={locale}
      dir={dir}
      className={`${plexSans.variable} ${plexMono.variable} ${notoArabic.variable}`}
    >
      <body className={plexSans.className}>
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
