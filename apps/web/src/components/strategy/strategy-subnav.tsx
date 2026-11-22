'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandSectionNav } from '../brand/brand-section-nav';
import { useT } from '../../lib/use-locale';
import { activeStrategyTab, isActiveSection, strategyTabs } from '../../lib/strategy-tabs';

/** DEC-029 4.9: three tabs (Plan · Execution · Review) with the active tab's sections below. */
export function StrategySubnav({ brandId, strategyId }: { brandId: string; strategyId: string }) {
  const t = useT();
  const pathname = usePathname();
  const tabs = strategyTabs(brandId, strategyId);
  const active = activeStrategyTab(tabs, pathname);
  const current = tabs.find((tab) => tab.id === active)!;
  return (
    <>
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
    </>
  );
}
