'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { StrategyJourney } from '@oma/domain/browser';
import { BrandSectionNav } from '../brand/brand-section-nav';
import { useT } from '../../lib/use-locale';
import { api } from '../../lib/api';
import { activeStrategyTab, isActiveSection, strategyTabs } from '../../lib/strategy-tabs';
import type { StrategyDetail, StrategyVersionDetail } from '../../lib/strategy-types';
import { fallbackStrategyJourney, type StrategyReadiness } from '../../lib/strategy-readiness';
import { StrategyStatusBadge } from './status-badge';
import { StrategyNextStep } from './strategy-next-step';

type HeaderData = {
  strategy: StrategyDetail;
  journey: StrategyJourney | null;
  versionStatus: string | null;
};

/**
 * Loads what every strategy page header needs: the strategy, its latest version
 * and the guided journey. The readiness endpoint is preferred; when it fails the
 * journey is computed from the version detail so the strip is always shown.
 */
function useStrategyHeader(brandId: string, strategyId: string, refreshKey: unknown) {
  const [data, setData] = useState<HeaderData | null>(null);
  useEffect(() => {
    let live = true;
    const base = `/api/v1/brands/${brandId}/strategies/${strategyId}`;
    void (async () => {
      try {
        const strat = await api<{ data: StrategyDetail }>(base);
        const latest = strat.data.latest_version;
        let journey: StrategyJourney | null = null;
        if (latest) {
          try {
            const r = await api<{ data: StrategyReadiness }>(
              `${base}/versions/${latest.id}/readiness`,
            );
            journey = r.data.journey;
          } catch {
            try {
              const v = await api<{ data: StrategyVersionDetail }>(`${base}/versions/${latest.id}`);
              journey = fallbackStrategyJourney(v.data);
            } catch {
              journey = null;
            }
          }
        }
        if (live) {
          setData({ strategy: strat.data, journey, versionStatus: latest?.status ?? null });
        }
      } catch {
        if (live) setData(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [brandId, strategyId, refreshKey]);
  return data;
}

/**
 * Shared header for every strategy page (DEC-029 4.9 tabs + DEC-030):
 * tabs (Plan · Execution · Review), the strategy name with one localized status,
 * track chips, the active tab's sections, and the guided five-step strip.
 */
export function StrategySubnav({
  brandId,
  strategyId,
  refreshKey,
  showJourney = true,
}: {
  brandId: string;
  strategyId: string;
  /** Change to reload the header after a mutation (submit, approve, save…). */
  refreshKey?: unknown;
  showJourney?: boolean;
}) {
  const t = useT();
  const pathname = usePathname();
  const tabs = strategyTabs(brandId, strategyId);
  const active = activeStrategyTab(tabs, pathname);
  const current = tabs.find((tab) => tab.id === active)!;
  const header = useStrategyHeader(brandId, strategyId, refreshKey);
  const latest = header?.strategy.latest_version ?? null;
  return (
    <div className="oma-strategy-header" data-testid="strategy-header">
      <BrandSectionNav
        backHref={`/app/brands/${brandId}/strategies`}
        backLabel={t('brand.nav.strategies')}
        ariaLabel={t('strategy.nav.label')}
        testId="strategy-subnav"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={tab.id === active}
            aria-current={tab.id === active ? 'page' : undefined}
            data-testid={`strategy-tab-${tab.id}`}
            className={`oma-plx-deliv-groups__btn oma-brand-nav-link${tab.id === active ? ' is-active' : ''}`}
          >
            {t(tab.labelKey)}
          </Link>
        ))}
      </BrandSectionNav>
      {header ? (
        <div className="oma-strategy-identity" data-testid="strategy-identity">
          <h1
            className="oma-strategy-identity__name"
            dir="auto"
            data-testid="strategy-name-heading"
          >
            {header.strategy.name}
          </h1>
          <div className="oma-strategy-identity__chips">
            <StrategyStatusBadge strategy={header.strategy} />
            {latest ? (
              <>
                <span
                  className={`oma-track-pill ${latest.organic_enabled ? 'oma-track-pill--organic' : 'oma-track-pill--off'}`}
                  data-testid="strategy-track-organic"
                  data-enabled={latest.organic_enabled ? 'true' : 'false'}
                >
                  {latest.organic_enabled
                    ? t('strategy.nav.organic')
                    : `${t('strategy.nav.organic')} · ${t('strategy.track.paused')}`}
                </span>
                <span
                  className={`oma-track-pill ${latest.paid_enabled ? 'oma-track-pill--paid' : 'oma-track-pill--off'}`}
                  data-testid="strategy-track-paid"
                  data-enabled={latest.paid_enabled ? 'true' : 'false'}
                >
                  {latest.paid_enabled
                    ? t('strategy.nav.paid')
                    : `${t('strategy.nav.paid')} · ${t('strategy.track.paused')}`}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {current.sections.length > 1 ? (
        <nav
          className="oma-chip-row oma-strategy-sections"
          aria-label={t(current.labelKey)}
          data-testid="strategy-sections"
        >
          {current.sections.map((s) => {
            const on = isActiveSection(pathname, s);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={on ? 'page' : undefined}
                className={`oma-track-pill${on ? ' is-active' : ''}`}
              >
                {t(s.labelKey)}
              </Link>
            );
          })}
        </nav>
      ) : null}
      {showJourney && header?.journey ? (
        <StrategyNextStep
          brandId={brandId}
          strategyId={strategyId}
          journey={header.journey}
          status={header.versionStatus}
        />
      ) : null}
    </div>
  );
}
