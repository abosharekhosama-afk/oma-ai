'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import type { BrandListItem, Paginated } from '../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../lib/brand-api';
import { PermissionDenied } from '../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../components/shell/select-company';
import { useT } from '../../../../lib/use-locale';
import { WorkspaceCard } from '../../../../components/brand/workspace-card';
import { brandAttention } from '../../../../lib/brand-attention';
import { EmptyState, ErrorState } from '../../../../components/ui/empty-state';

type SortKey = 'name' | 'updated' | 'status';

export default function BrandsListPage() {
  const t = useT();
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [filter, setFilter] = useState<'all' | 'needs_action' | 'approved'>('all');

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

  const visible = useMemo(() => {
    let rows = [...brands];
    if (filter === 'approved') {
      rows = rows.filter((b) => Boolean(b.current_approved_profile_version_id));
    } else if (filter === 'needs_action') {
      rows = rows.filter((b) => {
        const attention = brandAttention(b);
        return attention !== 'open_approved' && attention !== 'open_brand';
      });
    }
    rows.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'status') return a.status.localeCompare(b.status);
      return b.updated_at.localeCompare(a.updated_at);
    });
    return rows;
  }, [brands, filter, sortKey]);

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

  return (
    <div className="oma-stack" data-testid="brand-portfolio">
      <header className="oma-page-header">
        <div>
          <p className="oma-kicker">{t('brand.list.kicker')}</p>
          <h1>{t('brand.list.title')}</h1>
          <p className="oma-muted">{t('brand.list.subtitle')}</p>
        </div>
        <Link href="/app/brands/new" className="oma-btn">
          {t('brand.list.create')}
        </Link>
      </header>

      <form
        className="oma-filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(queryDraft.trim());
        }}
      >
        <label htmlFor="brand-search">{t('brand.list.searchLabel')}</label>
        <input
          id="brand-search"
          className="oma-input oma-input-inline"
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
        <label htmlFor="brand-filter" className="oma-sr-only">
          {t('brand.list.filterLabel')}
        </label>
        <select
          id="brand-filter"
          className="oma-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
        >
          <option value="all">{t('brand.list.filterAll')}</option>
          <option value="needs_action">{t('brand.list.filterNeedsAction')}</option>
          <option value="approved">{t('brand.list.filterApproved')}</option>
        </select>
        <label htmlFor="brand-sort" className="oma-sr-only">
          {t('brand.list.sortLabel')}
        </label>
        <select
          id="brand-sort"
          className="oma-select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="updated">{t('brand.list.sortUpdated')}</option>
          <option value="name">{t('brand.list.sortName')}</option>
          <option value="status">{t('brand.list.sortStatus')}</option>
        </select>
      </form>

      {error ? <ErrorState title={t('common.error')} body={error} /> : null}

      {loading ? (
        <div className="oma-skeleton" role="status" aria-label={t('common.loading')} />
      ) : visible.length === 0 && query ? (
        <EmptyState title={t('brand.list.noResults')} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('brand.list.emptyTitle')}
          body={t('brand.list.emptyBody')}
          action={
            <Link href="/app/brands/new" className="oma-btn">
              {t('brand.list.create')}
            </Link>
          }
        />
      ) : (
        <div className="oma-workspace-grid" data-testid="brand-workspace-grid">
          {visible.map((brand) => (
            <WorkspaceCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}
    </div>
  );
}
