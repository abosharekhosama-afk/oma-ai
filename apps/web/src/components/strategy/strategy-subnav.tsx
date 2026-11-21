'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandSectionNav } from '../brand/brand-section-nav';
import { useT } from '../../lib/use-locale';

export function StrategySubnav({ brandId, strategyId }: { brandId: string; strategyId: string }) {
  const t = useT();
  const pathname = usePathname();
  const base = `/app/brands/${brandId}/strategies/${strategyId}`;
  const backHref = `/app/brands/${brandId}/strategies`;
  const links = [
    { href: base, label: t('strategy.nav.overview'), exact: true },
    { href: `${base}/edit`, label: t('strategy.nav.foundation') },
    { href: `${base}/organic`, label: t('strategy.nav.organic') },
    { href: `${base}/paid`, label: t('strategy.nav.paid') },
    { href: `${base}/evidence`, label: t('strategy.nav.evidence') },
    { href: `${base}/review`, label: t('strategy.nav.review') },
    { href: `${base}/versions`, label: t('strategy.nav.versions') },
  ];
  return (
    <BrandSectionNav
      backHref={backHref}
      backLabel={t('brand.nav.strategies')}
      ariaLabel={t('strategy.nav.label')}
      testId="strategy-subnav"
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            role="tab"
            aria-current={active ? 'page' : undefined}
            className={`oma-plx-deliv-groups__btn oma-brand-nav-link${active ? ' is-active' : ''}`}
          >
            {link.label}
          </Link>
        );
      })}
    </BrandSectionNav>
  );
}
