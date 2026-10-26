'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getHome, type HomeBrandSummary } from '../../lib/home-api';
import { useT } from '../../lib/use-locale';
import { NetworkIcon } from '../content/network-icon';
import { initials } from '../content/post-preview-model';
import { homeLinks } from '../../lib/home-view-model';
import { Tooltip } from '../ui/tooltip';

/** Planable-style "Pages": workspace brands with their connected network icons. */
export function BrandPagesNav({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const search = useSearchParams();
  const [brands, setBrands] = useState<HomeBrandSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHome()
      .then((h) => !cancelled && setBrands(h.brand_summaries ?? []))
      .catch(() => !cancelled && setBrands([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const activeBrand = pathname.startsWith('/app/content') ? search.get('brand') : null;

  return (
    <div className="oma-nav-group oma-nav-pages">
      <div className="oma-nav-pages__head">
        <span className="oma-nav-heading" id="nav-pages">
          {t('nav.pages')}
        </span>
        <Link href="/app/brands/new" className="oma-nav-pages__add" aria-label={t('brand.list.create')}>
          +
        </Link>
      </div>
      {brands === null ? (
        <div className="oma-nav-pages__loading" aria-hidden="true" />
      ) : brands.length === 0 ? (
        <p className="oma-nav-pages__empty">{t('nav.pagesEmpty')}</p>
      ) : (
        <ul className="oma-nav-list" aria-labelledby="nav-pages">
          {brands.map((b) => {
            const active = activeBrand === b.id;
            const link = (
              <Link
                href={homeLinks.brand(b.id)}
                className="oma-nav-link oma-nav-page"
                data-active={active ? 'true' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <span className="oma-nav-page__avatar" aria-hidden="true">
                  {initials(b.name)}
                </span>
                <span className="oma-nav-link-label">{b.name}</span>
                <span className="oma-nav-page__nets">
                  {b.channels.slice(0, 4).map((c) => (
                    <NetworkIcon key={c} channel={c} size={14} />
                  ))}
                </span>
              </Link>
            );
            return (
              <li key={b.id}>
                {collapsed ? (
                  <Tooltip label={b.name}>
                    <span className="oma-nav-tooltip-wrap">{link}</span>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
