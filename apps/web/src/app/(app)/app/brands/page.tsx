'use client';
import { SearchIcon } from '../../../../components/ui/plx-icons';
import { OmaLinkButton } from '../../../../components/ui/oma-link-button';
import { Button, SearchInput, SelectField } from '@oma/ui/controls';

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
    <div className="plx-page" data-testid="brand-portfolio" data-surface="brands">
      <div className="plx-page__bar">
        <div className="plx-page__title-block">
          <p className="plx-page__kicker">{t('brand.list.kicker')}</p>
          <h1 className="plx-page__title">{t('brand.list.title')}</h1>
          <p className="plx-page__sub">{t('brand.list.subtitle')}</p>
        </div>
        
      </div>

      <div className="plx-page__body">
        <form
          className="plx-toolbar plx-toolbar--brands"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryDraft.trim());
          }}
          data-testid="brand-filter-card"
        >
          <div className="plx-toolbar__search">
            <SearchIcon width={16} height={16} aria-hidden />
            <input
              id="brand-search"
              type="search"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder={t('brand.list.searchLabel')}
              aria-label={t('brand.list.searchLabel')}
            />
            {queryDraft || query ? (
              <button
                type="button"
                className="plx-toolbar__clear"
                aria-label={t('brand.list.searchClear')}
                onClick={() => {
                  setQueryDraft('');
                  setQuery('');
                }}
              >
                ×
              </button>
            ) : null}
          </div>
          <SelectField
            id="brand-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            aria-label={t('brand.list.filterLabel')}
          >
            <option value="all">{t('brand.list.filterAll')}</option>
            <option value="needs_action">{t('brand.list.filterNeedsAction')}</option>
            <option value="approved">{t('brand.list.filterApproved')}</option>
          </SelectField>
          <SelectField
            id="brand-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label={t('brand.list.sortLabel')}
          >
            <option value="updated">{t('brand.list.sortUpdated')}</option>
            <option value="name">{t('brand.list.sortName')}</option>
            <option value="status">{t('brand.list.sortStatus')}</option>
          </SelectField>
        </form>

        {error ? <ErrorState title={t('common.error')} body={error} /> : null}

        {loading ? (
          <div className="oma-skeleton" role="status" aria-label={t('common.loading')} />
        ) : visible.length === 0 && query ? (
          <div className="plx-empty">
            <strong>{t('brand.list.noResults')}</strong>
          </div>
        ) : visible.length === 0 ? (
          <div className="plx-empty">
            <strong>{t('brand.list.emptyTitle')}</strong>
            <p>{t('brand.list.emptyBody')}</p>
            <div style={{ marginTop: 16 }}>
              <OmaLinkButton href="/app/brands/new" type="primary">
                {t('brand.list.create')}
              </OmaLinkButton>
            </div>
          </div>
        ) : (
          <div className="plx-card-grid" data-testid="brand-workspace-grid">
            {visible.map((brand) => (
              <WorkspaceCard key={brand.id} brand={brand} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
