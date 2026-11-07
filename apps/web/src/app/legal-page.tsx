import Link from 'next/link';
import { cookies } from 'next/headers';
import { resolveLocale, t } from '@oma/i18n';
import { PlxLogo } from '../components/ui/plx-icons';
import { LegalConsentBox } from '../components/legal-consent-box';
import './(auth)/auth-planable.css';

/** Professional legal & compliance shell for Terms of Service and Privacy Policy (EN + AR). */
export async function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const jar = await cookies();
  const locale = resolveLocale(jar.get('oma_locale')?.value ?? 'en');
  const k = (s: string) => t(locale, `legal.${kind}.${s}`);
  const sections = [1, 2, 3, 4, 5, 6];

  return (
    <main id="main" className="oma-legal-shell" dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <header className="oma-legal-shell__topbar">
        <div className="oma-legal-shell__topbar-inner">
          <Link href="/login" className="oma-legal-shell__brand">
            <PlxLogo sub="by IMKAN" />
          </Link>
          <nav className="oma-legal-shell__tabs" aria-label={t(locale, 'legal.nav.overview')}>
            <Link
              href="/terms"
              className="oma-legal-shell__tab"
              data-active={kind === 'terms' ? 'true' : 'false'}
            >
              {t(locale, 'legal.terms.title')}
            </Link>
            <Link
              href="/privacy"
              className="oma-legal-shell__tab"
              data-active={kind === 'privacy' ? 'true' : 'false'}
            >
              {t(locale, 'legal.privacy.title')}
            </Link>
          </nav>
          <Link href="/login" className="oma-legal-shell__back">
            {t(locale, 'auth.backToLogin')}
          </Link>
        </div>
      </header>

      <div className="oma-legal-shell__hero">
        <div className="oma-legal-shell__hero-inner">
          <span className="oma-legal-shell__eyebrow">{t(locale, 'legal.nav.overview')}</span>
          <h1 className="oma-legal-shell__title">{k('title')}</h1>
          <div className="oma-legal-shell__badges">
            <span className="oma-legal-shell__badge">{t(locale, 'legal.version_label')}</span>
            <span className="oma-legal-shell__badge oma-legal-shell__badge--muted">
              {t(locale, 'legal.updated')}
            </span>
          </div>
          <p className="oma-legal-shell__lead">{k('intro')}</p>
        </div>
      </div>

      <div className="oma-legal-shell__grid">
        <aside className="oma-legal-shell__toc" aria-label={t(locale, 'legal.nav.contents')}>
          <p className="oma-legal-shell__toc-title">{t(locale, 'legal.nav.contents')}</p>
          <ol className="oma-legal-shell__toc-list">
            {sections.map((n) => (
              <li key={n}>
                <a href={`#section-${n}`}>
                  <span className="oma-legal-shell__toc-num">0{n}</span>
                  <span>{k(`s${n}.title`)}</span>
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="oma-legal-shell__doc oma-legal">
          {sections.map((n) => (
            <section key={n} id={`section-${n}`} className="oma-legal-shell__section">
              <div className="oma-legal-shell__section-head">
                <span className="oma-legal-shell__section-num">0{n}</span>
                <h2>{k(`s${n}.title`)}</h2>
              </div>
              <p>{k(`s${n}.body`)}</p>
            </section>
          ))}

          <LegalConsentBox
            acceptLabel={t(locale, 'auth.terms.accept_now')}
            acceptedBadge={t(locale, 'auth.terms.accepted_badge')}
          />

          <footer className="oma-legal-shell__footer">
            <p className="oma-legal__meta">{t(locale, 'legal.contact')}</p>
            <div className="oma-legal-shell__footer-links">
              <Link href="/terms">{t(locale, 'legal.terms.title')}</Link>
              <span>·</span>
              <Link href="/privacy">{t(locale, 'legal.privacy.title')}</Link>
              <span>·</span>
              <Link href="/login">{t(locale, 'auth.backToLogin')}</Link>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
