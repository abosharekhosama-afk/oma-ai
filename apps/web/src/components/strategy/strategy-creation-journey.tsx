'use client';

import Link from 'next/link';
import { useT } from '../../lib/use-locale';

type Step = {
  id: string;
  label: string;
  href?: string;
  state: 'done' | 'current' | 'todo';
};

export function StrategyCreationJourney({ brandId, steps }: { brandId: string; steps: Step[] }) {
  const t = useT();
  return (
    <nav
      className="oma-strategy-journey oma-card oma-stack"
      aria-label={t('strategy.journey.title')}
      data-testid="strategy-creation-journey"
    >
      <header>
        <h3>{t('strategy.journey.title')}</h3>
        <p className="oma-muted">{t('strategy.journey.subtitle')}</p>
      </header>
      <ol className="oma-strategy-journey__list">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="oma-strategy-journey__step"
            data-state={step.state}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span className="oma-strategy-journey__index" aria-hidden>
              {index + 1}
            </span>
            <span className="oma-strategy-journey__label">
              {step.href && step.state !== 'todo' ? (
                <Link href={step.href} className="oma-text-link">
                  {step.label}
                </Link>
              ) : (
                step.label
              )}
            </span>
            {step.state === 'done' ? (
              <span className="oma-badge oma-badge-muted">{t('strategy.journey.done')}</span>
            ) : step.state === 'current' ? (
              <span className="oma-badge">{t('strategy.journey.current')}</span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="oma-muted oma-strategy-journey__note">
        <Link href={`/app/brands/${brandId}/profiles`} className="oma-text-link">
          {t('brand.detail.viewProfile')}
        </Link>
        {' · '}
        {t('strategy.journey.catalogNote')}
      </p>
    </nav>
  );
}

export function newStrategyJourneySteps(
  brandId: string,
  strategyId: string | null,
  t: (key: string) => string,
): Step[] {
  const base = strategyId ? `/app/brands/${brandId}/strategies/${strategyId}` : null;
  return [
    {
      id: 'create',
      label: t('strategy.journey.create'),
      state: strategyId ? 'done' : 'current',
    },
    {
      id: 'foundation',
      label: t('strategy.nav.foundation'),
      href: base ? `${base}/edit` : undefined,
      state: strategyId ? 'current' : 'todo',
    },
    {
      id: 'organic',
      label: t('strategy.nav.organic'),
      href: base ? `${base}/organic` : undefined,
      state: 'todo',
    },
    {
      id: 'review',
      label: t('strategy.nav.review'),
      href: base ? `${base}/review` : undefined,
      state: 'todo',
    },
    {
      id: 'plan',
      label: t('strategy.journey.planHandoff'),
      href: base ? `${base}/review` : undefined,
      state: 'todo',
    },
  ];
}
