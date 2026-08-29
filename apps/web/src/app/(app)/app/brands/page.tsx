'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import type { BrandListItem, Paginated } from '../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../lib/brand-api';
import { PermissionDenied } from '../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../components/shell/select-company';
import { useT } from '../../../../lib/use-locale';

export default function BrandsListPage() {
  const t = useT();
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    const path = query ? `/api/v1/brands?q=${encodeURIComponent(query)}` : '/api/v1/brands';
    api<Paginated<BrandListItem>>(path)
      .then((res) => {
        setBrands(res.data);
        setError(null);
      })
      .catch((err) => {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [query]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) {
    return (
      <div>
        <header className="oma-page-header">
          <h1>{t('brand.list.title')}</h1>
        </header>
        <SelectCompany />
      </div>
    );
  }
  if (loading && !query) return <p role="status">{t('common.loading')}</p>;
  // A failed search must keep the search form on screen, otherwise the user has
  // no way to correct the term that failed.
  if (error && !query) {
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

      <form
        className="oma-filter-row"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(queryDraft.trim());
        }}
      >
        <label htmlFor="brand-search">{t('brand.list.searchLabel')}</label>
        <input
          id="brand-search"
          className="oma-input"
          type="search"
          value={queryDraft}
          onChange={(event) => setQueryDraft(event.target.value)}
        />
        <button type="submit" className="oma-btn">
          {t('brand.list.searchSubmit')}
        </button>
        {query ? (
          <button
            type="button"
            className="oma-btn oma-btn-secondary"
            onClick={() => {
              setQueryDraft('');
              setQuery('');
            }}
          >
            {t('brand.list.searchClear')}
          </button>
        ) : null}
      </form>

      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : loading ? (
        <p role="status">{t('common.loading')}</p>
      ) : brands.length === 0 && query ? (
        <div className="oma-card" role="status">
          <p>{t('brand.list.noResults')}</p>
        </div>
      ) : brands.length === 0 ? (
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
                  {brand.current_approved_profile_version_id ? (
                    <span className="oma-badge">{t('brand.versions.current')}</span>
                  ) : null}
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
