import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveLocale, t } from '@oma/i18n';
import { LandingPage } from '../components/landing/landing-page';

export async function generateMetadata(): Promise<Metadata> {
  const jar = await cookies();
  const hdrs = await headers();
  const locale = resolveLocale(jar.get('oma_locale')?.value ?? hdrs.get('accept-language'));
  const title = t(locale, 'landing.meta.title');
  const description = t(locale, 'landing.meta.description');
  const ogTitle = t(locale, 'landing.meta.ogTitle');
  const ogDescription = t(locale, 'landing.meta.ogDescription');
  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: locale === 'ar' ? ['en_US'] : ['ar_SA'],
      siteName: 'OMA',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
    },
    alternates: {
      languages: {
        en: '/',
        ar: '/',
      },
    },
  };
}

/**
 * Public marketing landing for logged-out visitors.
 * Logged-in users keep going straight into the product (same as previous `/` → `/app`).
 */
export default async function HomePage() {
  const jar = await cookies();
  const session = jar.get(process.env.SESSION_COOKIE_NAME ?? 'oma_session');
  if (session?.value) {
    redirect('/app');
  }
  return <LandingPage />;
}
