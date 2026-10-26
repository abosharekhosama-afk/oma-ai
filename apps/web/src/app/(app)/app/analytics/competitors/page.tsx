'use client';

import Link from 'next/link';
import { useT } from '../../../../../lib/use-locale';

/**
 * Planable "Competitors" — benchmarking needs connected social channels and public
 * competitor data, which OMA does not have yet. Calm empty state, no sample numbers.
 */
export default function CompetitorsPage() {
  const t = useT();
  return (
    <div className="oma-pa" data-testid="analytics-competitors">
      <header className="oma-pa-top">
        <div className="oma-pa-top__start">
          <h1 className="oma-pa-title">{t('analytics.nav.competitors')}</h1>
        </div>
      </header>
      <div className="oma-pa-body oma-pa-body--single">
        <main className="oma-pa-main">
          <section className="oma-pa-card oma-pa-connect">
            <div className="oma-pa-quadrant" aria-hidden>
              <span>{t('analytics.competitors.efficient')}</span>
              <span>{t('analytics.competitors.leading')}</span>
              <span>{t('analytics.competitors.quiet')}</span>
              <span>{t('analytics.competitors.grinding')}</span>
            </div>
            <h2 className="oma-pa-card__title">{t('analytics.competitors.title')}</h2>
            <p className="oma-pa-muted">{t('analytics.competitors.body')}</p>
            <Link className="oma-pa-btn" href="/app/analytics">
              {t('analytics.competitors.back')}
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
