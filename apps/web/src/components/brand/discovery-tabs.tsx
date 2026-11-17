'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../../lib/use-locale';

type Counts = { pages?: number | null; products?: number | null };

/** One place to move between the discovery summary, pages and products (replaces ad-hoc links). */
export function DiscoveryTabs({ brandId, counts }: { brandId: string; counts?: Counts }) {
  const t = useT();
  const pathname = usePathname();
  const base = `/app/brands/${brandId}/discovery`;
  const tabs = [
    { id: 'summary', href: base, label: t('brand.discovery.tabSummary'), count: null },
    {
      id: 'pages',
      href: `${base}/pages`,
      label: t('brand.discovery.pagesTitle'),
      count: counts?.pages ?? null,
    },
    {
      id: 'products',
      href: `${base}/products`,
      label: t('brand.discovery.productsTitle'),
      count: counts?.products ?? null,
    },
  ];
  return (
    <nav
      className="oma-plx-deliv-groups oma-plx-brand-discovery-tabs"
      aria-label={t('brand.discovery.tabsLabel')}
      data-testid="discovery-tabs"
    >
      {tabs.map((tab) => {
        const active = tab.id === 'summary' ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`oma-plx-deliv-groups__btn oma-brand-nav-link${active ? ' is-active' : ''}`}
          >
            <span>{tab.label}</span>
            {tab.count != null ? (
              <span className="oma-plx-reviews-tabs__count">{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
