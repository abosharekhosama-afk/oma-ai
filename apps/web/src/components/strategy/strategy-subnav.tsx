'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandSectionNav } from '../brand/brand-section-nav';
import { useT } from '../../lib/use-locale';
import { api } from '../../lib/api';
import type { StrategyDetail } from '../../lib/strategy-types';
import { StrategyStatusBadge } from './status-badge';
import {
  activeStrategyWorkspaceLink,
  strategyWorkspaceLinks,
} from '../../lib/strategy-workspace-nav';
import { isActiveSection } from '../../lib/strategy-tabs';

type HeaderData = {
  strategy: StrategyDetail;
};

function useStrategyHeader(brandId: string, strategyId: string, refreshKey: unknown) {
  const [data, setData] = useState<HeaderData | null>(null);
  useEffect(() => {
    let live = true;
    void api<{ data: StrategyDetail }>(`/api/v1/brands/${brandId}/strategies/${strategyId}`)
      .then((strat) => {
        if (live) setData({ strategy: strat.data });
      })
      .catch(() => {
        if (live) setData(null);
      });
    return () => {
      live = false;
    };
  }, [brandId, strategyId, refreshKey]);
  return data;
}

/**
 * Strategy workspace navigation: back + flat tabs + compact title row (no journey quick-access strip).
 */
export function StrategySubnav({
  brandId,
  strategyId,
  refreshKey,
}: {
  brandId: string;
  strategyId: string;
  refreshKey?: unknown;
}) {
  const t = useT();
  const pathname = usePathname();
  const links = strategyWorkspaceLinks(brandId, strategyId);
  const header = useStrategyHeader(brandId, strategyId, refreshKey);
  const latest = header?.strategy.latest_version ?? null;
  const active = activeStrategyWorkspaceLink(pathname, links);

  return (
    <div className="oma-strategy-header oma-strategy-header--flat" data-testid="strategy-header">
      <BrandSectionNav
        backHref={`/app/brands/${brandId}/strategies`}
        backLabel={t('brand.nav.strategies')}
        ariaLabel={t('strategy.nav.label')}
        testId="strategy-subnav"
      >
        {links.map((link) => {
          const on = isActiveSection(pathname, link);
          return (
            <Link
              key={link.id}
              href={link.href}
              role="tab"
              aria-selected={link.id === active.id}
              aria-current={on ? 'page' : undefined}
              data-testid={`strategy-tab-${link.id}`}
              className={`oma-ws-tab oma-brand-nav-link${on ? ' is-active' : ''}`}
            >
              {t(link.labelKey)}
            </Link>
          );
        })}
      </BrandSectionNav>
      {header ? (
        <div
          className="oma-strategy-identity oma-strategy-identity--compact"
          data-testid="strategy-identity"
        >
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
                  className={`oma-track-pill oma-track-pill--sm ${latest.organic_enabled ? 'oma-track-pill--organic' : 'oma-track-pill--off'}`}
                  data-testid="strategy-track-organic"
                >
                  {t('strategy.nav.organic')}
                  {!latest.organic_enabled ? ` · ${t('strategy.track.paused')}` : ''}
                </span>
                <span
                  className={`oma-track-pill oma-track-pill--sm ${latest.paid_enabled ? 'oma-track-pill--paid' : 'oma-track-pill--off'}`}
                  data-testid="strategy-track-paid"
                >
                  {t('strategy.nav.paid')}
                  {!latest.paid_enabled ? ` · ${t('strategy.track.paused')}` : ''}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
