import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { MOBILE_OPS_ATTR, MOBILE_OPS_VALUE } from '../lib/mobile-ops-flag';
import { cookies, headers } from 'next/headers';
import { resolveDir, resolveLocale, t, type Locale } from '@oma/i18n';
import { publicSiteIndexable, resolvePublicSiteUrl } from '../lib/public-site';
import { OmaAntdProvider } from '../components/ui/oma-antd-provider';
import { LocaleProvider } from '../lib/locale-context';
import './globals.css';
import '../styles/oma-fonts.css';
import '../styles/ui-polish.css';
import '../styles/oma-mobile-cascade-final.css';
import '../styles/oma-typography-unified.css';
import '../styles/oma-responsive-density.css';
import '../styles/oma-brand-responsive.css';
import '../styles/oma-workspace-surfaces.css';
import '../styles/oma-shimmer-mobile.css';
import '../styles/oma-content-calendar-mobile.css';

const siteUrl = resolvePublicSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'OMA AI',
    template: '%s · OMA AI',
  },
  description: 'OMA AI by IMKAN — content planning and collaboration for agencies and brands.',
  applicationName: 'OMA',
  ...(publicSiteIndexable()
    ? {
        robots: { index: true, follow: true },
        alternates: { canonical: '/' },
      }
    : {
        robots: { index: false, follow: false },
      }),
};

/** Native device-width viewport; mobile uses responsive CSS (no document zoom). */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('oma_locale')?.value;
  const locale: Locale = resolveLocale(localeCookie ?? hdrs.get('accept-language'));
  const dir = resolveDir(locale);
  return (
    <html lang={locale} dir={dir} data-oma-typeface="oma-system-ui" suppressHydrationWarning>
      <body data-oma-font="oma-system-ui">
        <Script id="oma-mobile-ops-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var m=window.matchMedia('(max-width: 767px)');var k='${MOBILE_OPS_ATTR}';var v='${MOBILE_OPS_VALUE}';var r=document.documentElement;var s=function(){if(m.matches)r.setAttribute(k,v);else r.removeAttribute(k);};s();if(m.addEventListener)m.addEventListener('change',s);else if(m.addListener)m.addListener(s);}catch(e){}})();`}
        </Script>
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
