'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';

type BrandListItem = { id: string; name: string };

export function BrandContext() {
  const t = useT();
  const pathname = usePathname();
  const [brands, setBrands] = useState<BrandListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: BrandListItem[]; items?: BrandListItem[] }>('/api/v1/brands')
      .then((res) => setBrands(res.data ?? res.items ?? []))
      .catch((err) => {
        if (err?.status === 409 || err?.status === 403) setBrands([]);
        else setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const brandIdFromPath = useMemo(() => {
    const match = pathname.match(/^\/app\/brands\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  if (error) {
    return (
      <span className="oma-brand-context oma-muted" role="status">
        {t('shell.brandUnavailable')}
      </span>
    );
  }

  if (!brands) {
    return (
      <span className="oma-brand-context oma-muted" role="status">
        {t('common.loading')}
      </span>
    );
  }

  if (brands.length === 0) {
    return (
      <Link href="/app/brands" className="oma-brand-context-link">
        {t('shell.brandNone')}
      </Link>
    );
  }

  const active = brands.find((b) => b.id === brandIdFromPath) ?? null;

  return (
    <label className="oma-brand-context">
      <span className="oma-field-inline-label">{t('shell.brand')}</span>
      <select
        className="oma-select"
        aria-label={t('shell.brand')}
        value={active?.id ?? ''}
        onChange={(e) => {
          const id = e.target.value;
          if (id) window.location.assign(`/app/brands/${id}`);
          else window.location.assign('/app/brands');
        }}
      >
        <option value="">{t('shell.brandAll')}</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
