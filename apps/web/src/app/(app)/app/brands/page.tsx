'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import type { BrandListItem, Paginated } from '../../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../../lib/brand-api';
import { PermissionDenied } from '../../../../components/shell/permission-denied';
import { useT } from '../../../../lib/use-locale';

export default function BrandsListPage() {
  const t = useT();
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api<Paginated<BrandListItem>>('/api/v1/brands')
      .then((res) => setBrands(res.data))
      .catch((err) => {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <p role="status">{t('common.loading')}</p>;
  if (error) {
    return (
      <div className="oma-card" role="alert">
        <h1>{t('brand.list.title')}</h1>
        <p style={{ color: 'var(--status-danger)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <header className="oma-page-header">
        <h1>{t('brand.list.title')}</h1>
        <Link href="/app/brands/new" className="oma-btn">
          {t('brand.list.create')}
        </Link>
      </header>

      {brands.length === 0 ? (
        <div className="oma-card" role="status">
          <h2>{t('brand.list.emptyTitle')}</h2>
          <p className="oma-muted">{t('brand.list.emptyBody')}</p>
          <Link href="/app/brands/new" className="oma-btn">
            {t('brand.list.create')}
          </Link>
        </div>
      ) : (
        <ul className="oma-brand-list">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link href={`/app/brands/${brand.id}`} className="oma-card oma-brand-list-item">
                <div>
                  <strong>{brand.name}</strong>
                  <span className="oma-badge oma-badge-muted">{brand.status}</span>
                </div>
                <p className="oma-muted" style={{ margin: '0.25rem 0 0', fontSize: 14 }}>
                  {brand.primary_website_url ? (
                    <span className="oma-ltr">{brand.primary_website_url}</span>
                  ) : (
                    t('brand.list.noWebsite')
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
