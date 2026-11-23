'use client';

import type { InsightItem } from '../../lib/brand-types';
import { insightPayload, shortDisplayUrl } from '../../lib/profile-display';
import { useT } from '../../lib/use-locale';

function imageUrlsFromLogo(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const rec = payload as Record<string, unknown>;
  const urls: string[] = [];
  for (const key of ['og_image', 'favicon']) {
    const v = rec[key];
    if (typeof v === 'string' && v.trim()) urls.push(v.trim());
  }
  const list = rec.urls;
  if (Array.isArray(list)) {
    for (const u of list) {
      if (typeof u === 'string' && u.trim()) urls.push(u.trim());
    }
  }
  return [...new Set(urls)].slice(0, 6);
}

type SocialRow = { network?: string; url?: string };

function socialRows(payload: unknown): SocialRow[] {
  if (Array.isArray(payload)) {
    return payload.filter((r): r is SocialRow => r != null && typeof r === 'object');
  }
  if (payload && typeof payload === 'object') {
    const profiles = (payload as Record<string, unknown>).profiles;
    if (Array.isArray(profiles)) {
      return profiles.filter((r): r is SocialRow => r != null && typeof r === 'object');
    }
  }
  return [];
}

type CatalogItem = {
  name?: string;
  description?: string;
  category?: string;
  price?: string;
  primary_media_view_url?: string;
};

function catalogItems(payload: unknown): CatalogItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
    .map((r) => ({
      name: typeof r.name === 'string' ? r.name : undefined,
      description: typeof r.description === 'string' ? r.description : undefined,
      category: typeof r.category === 'string' ? r.category : undefined,
      price: typeof r.price === 'string' ? r.price : undefined,
      primary_media_view_url:
        typeof r.primary_media_view_url === 'string' ? r.primary_media_view_url : undefined,
    }))
    .filter((i) => i.name);
}

function colorList(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
  }
  if (!payload || typeof payload !== 'object') return [];
  const rec = payload as Record<string, unknown>;
  const raw = rec.theme ?? rec.colors;
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === 'string');
  }
  return [];
}

/** Field-aware insight value (images, social links, catalog rows). */
export function InsightRichValue({ insight }: { insight: InsightItem }) {
  const t = useT();
  const payload = insightPayload(insight);
  const field = insight.field_key;

  if (field === 'brand.logo') {
    const srcs = imageUrlsFromLogo(payload);
    if (srcs.length === 0) {
      return <span className="oma-muted">{t('brand.profile.emptyValue')}</span>;
    }
    return (
      <div className="oma-insight-media-row">
        {srcs.map((src) => (
          <a
            key={src}
            href={src}
            className="oma-insight-thumb"
            target="_blank"
            rel="noreferrer noopener"
            title={shortDisplayUrl(src)}
          >
            <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" />
          </a>
        ))}
      </div>
    );
  }

  if (field === 'brand.social') {
    const rows = socialRows(payload);
    if (rows.length === 0) {
      return <span className="oma-muted">{t('brand.profile.emptyValue')}</span>;
    }
    return (
      <ul className="oma-insight-social-list">
        {rows.map((row, idx) => {
          const url = row.url?.trim();
          if (!url) return null;
          const network = row.network?.trim() || t('brand.profile.socialLink');
          return (
            <li key={`${network}-${idx}`}>
              <span className="oma-insight-social-list__net">{network}</span>
              <a href={url} className="oma-text-link oma-ltr" target="_blank" rel="noreferrer noopener">
                {shortDisplayUrl(url, 56)}
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  if (field === 'brand.source_url' && typeof payload === 'string' && payload.trim()) {
    const url = payload.trim();
    return (
      <a href={url} className="oma-text-link oma-ltr" target="_blank" rel="noreferrer noopener">
        {shortDisplayUrl(url, 64)}
      </a>
    );
  }

  if (field === 'brand.colors') {
    const colors = colorList(payload);
    if (colors.length === 0) {
      return <span className="oma-muted">{t('brand.profile.emptyValue')}</span>;
    }
    return (
      <div className="oma-insight-color-row">
        {colors.map((color) => (
          <span key={color} className="oma-insight-color-swatch" title={color} style={{ background: color }} />
        ))}
      </div>
    );
  }

  if (field === 'catalog.products' || field === 'catalog.services') {
    const items = catalogItems(payload);
    if (items.length === 0) {
      return <span className="oma-muted">{t('brand.profile.emptyValue')}</span>;
    }
    return (
      <ul className="oma-insight-catalog-grid">
        {items.map((item) => (
          <li key={item.name} className="oma-insight-catalog-card">
            {item.primary_media_view_url ? (
              <img
                src={item.primary_media_view_url}
                alt=""
                className="oma-insight-catalog-card__img"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            ) : (
              <span className="oma-insight-catalog-card__placeholder" aria-hidden />
            )}
            <div className="oma-insight-catalog-card__body">
              <strong dir="auto">{item.name}</strong>
              {item.category ? <span className="oma-muted">{item.category}</span> : null}
              {item.price ? <span>{item.price}</span> : null}
              {item.description ? (
                <p className="oma-muted oma-insight-catalog-card__desc">{item.description}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (typeof payload === 'string' && payload.trim()) {
    return <span dir="auto">{payload.trim()}</span>;
  }

  if (payload === null || payload === undefined) {
    return <span className="oma-muted">{t('brand.profile.emptyValue')}</span>;
  }

  const fallback = typeof insight.text_value === 'string' ? insight.text_value.trim() : '';
  if (fallback && !fallback.startsWith('{') && !fallback.startsWith('[')) {
    return <span dir="auto">{fallback}</span>;
  }

  return <span className="oma-muted">{t('brand.profile.emptyValue')}</span>;
}