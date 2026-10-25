import Link from 'next/link';
import { cookies } from 'next/headers';
import { resolveLocale, t } from '@oma/i18n';

/** Shared shell for the static Terms / Privacy pages (server component, en + ar). */
export async function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const jar = await cookies();
  const locale = resolveLocale(jar.get('oma_locale')?.value ?? 'en');
  const k = (s: string) => t(locale, `legal.${kind}.${s}`);
  const sections = [1, 2, 3, 4];
  return (
    <main id="main" className="oma-legal" dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <h1>{k('title')}</h1>
      <p className="oma-legal__meta">{t(locale, 'legal.updated')}</p>
      <p>{k('intro')}</p>
      {sections.map((n) => (
        <section key={n}>
          <h2>{k(`s${n}.title`)}</h2>
          <p>{k(`s${n}.body`)}</p>
        </section>
      ))}
      <p className="oma-legal__meta">{t(locale, 'legal.contact')}</p>
      <p>
        <Link href="/login">{t(locale, 'auth.backToLogin')}</Link>
      </p>
    </main>
  );
}
