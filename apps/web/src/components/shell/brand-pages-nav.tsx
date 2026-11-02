'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getHome, type HomeBrandSummary } from '../../lib/home-api';
import { useT } from '../../lib/use-locale';
import { NetworkIcon } from '../content/network-icon';
import { initials } from '../content/post-preview-model';
import { brandNetworks, homeLinks } from '../../lib/home-view-model';
import { BRAND_LOGO_EVENT, setActiveBrandId, useActiveBrandId } from '../../lib/active-brand';
import { Tooltip } from '../ui/tooltip';

/** Planable-style "Pages": workspace brands with their connected network icons. */
export function BrandPagesNav({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  const [brands, setBrands] = useState<HomeBrandSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getHome()
        .then((h) => !cancelled && setBrands(h.brand_summaries ?? []))
        .catch(() => !cancelled && setBrands([]));
    };
    load();
    const onLogo = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; logo_url?: string | null }>).detail;
      if (!detail?.id) return;
      setBrands((rows) =>
        rows?.map((b) => (b.id === detail.id ? { ...b, logo_url: detail.logo_url ?? null } : b)) ??
        rows,
      );
    };
    window.addEventListener(BRAND_LOGO_EVENT, onLogo);
    return () => {
      cancelled = true;
      window.removeEventListener(BRAND_LOGO_EVENT, onLogo);
    };
  }, []);

  const activeBrand = useActiveBrandId();

  return (
    <div className="oma-nav-group oma-nav-pages">
      <div className="oma-nav-pages__head">
        <span className="oma-nav-heading" id="nav-pages">
          {t('nav.pages')}
        </span>
        <Link
          href="/app/brands/new"
          className="oma-nav-pages__add"
          aria-label={t('brand.list.create')}
        >
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
                onClick={() => setActiveBrandId(b.id)}
              >
                <span className="oma-nav-page__avatar" aria-hidden="true">
                  {b.logo_url ? (
                    <img className="oma-brand-logo__img" src={b.logo_url} alt="" />
                  ) : (
                    initials(b.name)
                  )}
                </span>
                <span className="oma-nav-link-label">{b.name}</span>
                <span className="oma-nav-page__nets">
                  {brandNetworks(b)
                    .slice(0, 4)
                    .map((c) => (
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
