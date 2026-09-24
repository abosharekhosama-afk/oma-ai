import type { Metadata } from 'next';
import { JetBrains_Mono, Noto_Sans_Arabic } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { resolveDir, resolveLocale, t, type Locale } from '@oma/i18n';
import { OmaAntdProvider } from '../components/ui/oma-antd-provider';
import { LocaleProvider } from '../lib/locale-context';
import './globals.css';

/** DEC-017: English face is the Planable system-UI stack. Latin webfonts are not the product face. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
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
      className={`${jetbrainsMono.variable} ${notoArabic.variable}`}
      data-oma-typeface="planable-system"
    >
      <body data-oma-font="planable-system">
        <a href="#main" className="oma-skip-link">
          {t(locale, 'shell.skip')}
        </a>
        <OmaAntdProvider locale={locale}>
          <LocaleProvider locale={locale}>{children}</LocaleProvider>
        </OmaAntdProvider>
      </body>
    </html>
  );
}
