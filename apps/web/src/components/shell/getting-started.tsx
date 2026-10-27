'use client';
import { OmaLinkButton } from '../ui/oma-link-button';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../lib/use-locale';

const STORAGE_KEY = 'oma.getting-started.dismissed.v1';

type Step = {
  id: string;
  labelKey: string;
  href: string;
  done: boolean;
};

/**
 * Dismissible Getting Started checklist for Command Center.
 * Not a blocking tour — hidden after dismiss or full completion.
 */
export function GettingStartedChecklist({
  hasTenant,
  brandCount,
  approvedProfileCount,
  hasCampaign,
  steps: serverSteps,
}: {
  hasTenant: boolean;
  brandCount: number;
  approvedProfileCount: number;
  hasCampaign: boolean;
  /** Server-computed checklist (GET /api/v1/home); overrides the local heuristics. */
  steps?: Array<{ id: string; done: boolean; href: string }>;
}) {
  const t = useT();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const localSteps: Step[] = useMemo(
    () => [
      {
        id: 'company',
        labelKey: 'home.gettingStarted.company',
        href: hasTenant ? '/app/team' : '/app/select-company',
        done: hasTenant,
      },
      {
        id: 'brand',
        labelKey: 'home.gettingStarted.brand',
        href: '/app/brands/new',
        done: brandCount > 0,
      },
      {
        id: 'profile',
        labelKey: 'home.gettingStarted.profile',
        href: '/app/brands',
        done: approvedProfileCount > 0,
      },
      {
        id: 'strategy',
        labelKey: 'home.gettingStarted.strategy',
        href: '/app/brands',
        done: approvedProfileCount > 0,
      },
      {
        id: 'campaign',
        labelKey: 'home.gettingStarted.campaign',
        href: '/app/campaigns',
        done: hasCampaign,
      },
      {
        id: 'content',
        labelKey: 'home.gettingStarted.content',
        href: '/app/content',
        done: hasCampaign,
      },
      {
        id: 'produce',
        labelKey: 'home.gettingStarted.produce',
        href: '/app/requests',
        done: false,
      },
      {
        id: 'review',
        labelKey: 'home.gettingStarted.review',
        href: '/app/reviews',
        done: false,
      },
    ],
    [hasTenant, brandCount, approvedProfileCount, hasCampaign],
  );
  const steps: Step[] = useMemo(() => {
    if (!serverSteps?.length) return localSteps;
    return localSteps.map((s) => {
      const server = serverSteps.find((x) => x.id === s.id);
      return server ? { ...s, done: server.done, href: server.href || s.href } : s;
    });
  }, [serverSteps, localSteps]);

  const allDone = steps.every((s) => s.done);
  if (dismissed || allDone) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  const next = steps.find((s) => !s.done) ?? steps[0];

  return (
    <section
      className="oma-card oma-getting-started"
      data-testid="getting-started"
      aria-labelledby="getting-started-title"
    >
      <header className="oma-getting-started-head">
        <div>
          <p className="oma-kicker">{t('home.gettingStarted.kicker')}</p>
          <h2 id="getting-started-title">{t('home.gettingStarted.title')}</h2>
          <p className="oma-muted">{t('home.gettingStarted.body')}</p>
        </div>
        <Button type="default" onClick={dismiss}>
          {t('home.gettingStarted.dismiss')}
        </Button>
      </header>
      <ol className="oma-getting-started-list">
        {steps.map((step) => (
          <li key={step.id} data-done={step.done ? 'true' : 'false'}>
            <Link href={step.href} className="oma-getting-started-row">
              <span className="oma-getting-started-mark" aria-hidden="true">
                {step.done ? '✓' : '○'}
              </span>
              <span>{t(step.labelKey)}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="oma-getting-started-next">
        <OmaLinkButton href={next.href} type="primary">
          {t('home.gettingStarted.nextPrefix')}: {t(next.labelKey)}
        </OmaLinkButton>
      </p>
    </section>
  );
}

export function JourneyStrip() {
  const t = useT();
  const hops = [
    { href: '/app/brands', label: t('home.journeyStrip.brand') },
    { href: '/app/brands', label: t('home.journeyStrip.strategy') },
    { href: '/app/campaigns', label: t('home.journeyStrip.campaign') },
    { href: '/app/content', label: t('home.journeyStrip.content') },
    { href: '/app/requests', label: t('home.journeyStrip.request') },
    { href: '/app/tasks', label: t('home.journeyStrip.task') },
    { href: '/app/deliverables', label: t('home.journeyStrip.deliverable') },
    { href: '/app/reviews', label: t('home.journeyStrip.review') },
    { href: '/app/schedule', label: t('home.journeyStrip.schedule') },
    { href: '/app/analytics', label: t('home.journeyStrip.analytics') },
  ];
  return (
    <nav
      className="oma-journey-strip"
      aria-label={t('home.journeyStrip.label')}
      data-testid="journey-strip"
    >
      <ol>
        {hops.map((hop, i) => (
          <li key={hop.label + i}>
            {i > 0 ? (
              <span className="oma-journey-sep" aria-hidden="true">
                →
              </span>
            ) : null}
            <Link href={hop.href}>{hop.label}</Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ConnectionHonestyPanel() {
  const t = useT();
  return (
    <section
      className="oma-card oma-connection-honesty"
      data-testid="connection-honesty"
      aria-labelledby="connection-honesty-title"
    >
      <h2 id="connection-honesty-title">{t('home.honesty.title')}</h2>
      <ul className="oma-dense-list">
        <li>
          <strong>{t('home.honesty.ai')}</strong>
          <span className="oma-badge">{t('status.user.notConnected')}</span>
          <p className="oma-muted">{t('home.honesty.aiBody')}</p>
        </li>
        <li>
          <strong>{t('home.honesty.integrations')}</strong>
          <span className="oma-badge">{t('status.user.deferred')}</span>
          <p className="oma-muted">{t('home.honesty.integrationsBody')}</p>
        </li>
        <li>
          <strong>{t('home.honesty.demo')}</strong>
          <span className="oma-badge oma-badge--warning">{t('status.user.sampleData')}</span>
          <p className="oma-muted">{t('home.honesty.demoBody')}</p>
        </li>
      </ul>
      <Link href="/app/settings" className="oma-text-link">
        {t('home.honesty.settingsLink')}
      </Link>
    </section>
  );
}
