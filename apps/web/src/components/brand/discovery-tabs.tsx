'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftOutlined } from '../ui/lucide-icons';
import { useT } from '../../lib/use-locale';

type Counts = { pages?: number | null; products?: number | null };

/** Discovery sub-navigation: back + summary / pages / products (single tab row). */
export function DiscoveryTabs({
  brandId,
  counts,
  backHref,
  backLabel,
}: {
  brandId: string;
  counts?: Counts;
  backHref?: string;
  backLabel?: string;
}) {
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
  const back = backHref ?? `/app/brands/${brandId}/evidence`;
  const backText = backLabel ?? t('brand.nav.evidenceHub');

  return (
    <nav
      className="oma-ws-tabs oma-discovery-tabs"
      aria-label={t('brand.discovery.tabsLabel')}
      data-testid="discovery-tabs"
      role="tablist"
    >
      <Link
        href={back}
        className="oma-ws-tab oma-discovery-tabs__back"
        data-testid="discovery-tabs-back"
      >
        <ArrowLeftOutlined width={14} height={14} aria-hidden />
        <span>{backText}</span>
      </Link>
      {tabs.map((tab) => {
        const active = tab.id === 'summary' ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-current={active ? 'page' : undefined}
            className={`oma-ws-tab${active ? ' is-active' : ''}`}
          >
            <span>{tab.label}</span>
            {tab.count != null ? (
              <span className="oma-discovery-tabs__count" aria-hidden>
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
