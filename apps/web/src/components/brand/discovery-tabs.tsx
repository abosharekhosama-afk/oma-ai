'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../../lib/use-locale';

type Counts = { pages?: number | null; products?: number | null };

/** Discovery sub-navigation: summary, pages, products. */
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
      className="oma-discovery-tabs"
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
            className={`oma-discovery-tabs__tab${active ? ' is-active' : ''}`}
          >
            <span>{tab.label}</span>
            {tab.count != null ? (
              <span className="oma-discovery-tabs__count">{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
