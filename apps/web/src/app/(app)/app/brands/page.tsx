'use client';

import { SearchIcon } from '../../../../components/ui/plx-icons';
import { FilterOutlined, SearchOutlined, DownOutlined, UpOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { OmaLinkButton } from '../../../../components/ui/oma-link-button';
import { Button, Input } from '@oma/ui/controls';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [filterSheet, setFilterSheet] = useState(false);
  const [filterSection, setFilterSection] = useState<string | null>('search');
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setActionsHost(document.getElementById('oma-workspace-top-actions'));
  }, []);

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
      if (sortKey === 'status') return (a.status || '').localeCompare(b.status || '');
      const au = a.updated_at || a.created_at || '';
      const bu = b.updated_at || b.created_at || '';
      return bu.localeCompare(au);
    });
    return rows;
  }, [brands, filter, sortKey]);

  const activeFilterCount =
    (query ? 1 : 0) + (filter !== 'all' ? 1 : 0) + (sortKey !== 'updated' ? 1 : 0);

  if (tenantRequired) return <SelectCompany />;
  if (denied) return <PermissionDenied />;

  const headerActions = (
    <div className="oma-workspace-top-actions-inner">
      <button
        type="button"
        className="oma-header-icon-btn"
        data-testid="brand-open-filters"
        aria-label={t('brand.list.filterLabel')}
        onClick={() => setFilterSheet(true)}
      >
        <FilterOutlined />
        {activeFilterCount > 0 ? (
          <span className="oma-header-icon-btn__badge">{activeFilterCount}</span>
        ) : null}
      </button>
      <OmaLinkButton href="/app/brands/new" type="primary" data-testid="shell-create-brand">
        {t('brand.list.create')}
      </OmaLinkButton>
    </div>
  );

  return (
    <div className="plx-page" data-testid="brand-portfolio" data-surface="brands">
      {actionsHost ? createPortal(headerActions, actionsHost) : null}

      <div className="plx-page__bar">
        <div className="plx-page__title-block">
          <p className="plx-page__kicker">{t('brand.list.kicker')}</p>
          <h1 className="plx-page__title">{t('brand.list.title')}</h1>
          <p className="plx-page__sub">{t('brand.list.subtitle')}</p>
        </div>
      </div>

      <div className="plx-page__body">
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

      {filterSheet ? (
        <aside className="oma-req-filter-panel" data-testid="brand-filter-panel">
          <header className="oma-req-filter-panel__head">
            <strong>{t('brand.list.filterLabel')}</strong>
            <button
              type="button"
              className="oma-req-filter-panel__close"
              aria-label={t('common.close') || 'Close'}
              onClick={() => {
                setQuery(queryDraft.trim());
                setFilterSheet(false);
              }}
            >
              ×
            </button>
          </header>
          <div className="oma-filter-accordion-list">
            <div className="oma-filter-accordion">
              <button
                type="button"
                className="oma-filter-accordion__row"
                data-open={filterSection === 'search' ? 'true' : 'false'}
                onClick={() => setFilterSection((s) => (s === 'search' ? null : 'search'))}
              >
                <span className="oma-filter-accordion__ico">
                  <SearchOutlined />
                </span>
                <span>{t('brand.list.searchLabel')}</span>
                <span className="oma-filter-accordion__caret">
                  {filterSection === 'search' ? <UpOutlined /> : <DownOutlined />}
                </span>
              </button>
              {filterSection === 'search' ? (
                <div className="oma-filter-accordion__body">
                  <Input
                    type="search"
                    value={queryDraft}
                    onChange={(e) => setQueryDraft(e.target.value)}
                    placeholder={t('brand.list.searchLabel')}
                    aria-label={t('brand.list.searchLabel')}
                  />
                </div>
              ) : null}
            </div>

            <div className="oma-filter-accordion">
              <button
                type="button"
                className="oma-filter-accordion__row"
                data-open={filterSection === 'status' ? 'true' : 'false'}
                onClick={() => setFilterSection((s) => (s === 'status' ? null : 'status'))}
              >
                <span className="oma-filter-accordion__ico">
                  <UnorderedListOutlined />
                </span>
                <span>{t('brand.list.filterLabel')}</span>
                <span className="oma-filter-accordion__caret">
                  {filterSection === 'status' ? <UpOutlined /> : <DownOutlined />}
                </span>
              </button>
              {filterSection === 'status' ? (
                <div className="oma-filter-accordion__body">
                  {(
                    [
                      ['all', t('brand.list.filterAll')],
                      ['needs_action', t('brand.list.filterNeedsAction')],
                      ['approved', t('brand.list.filterApproved')],
                    ] as const
                  ).map(([val, label]) => (
                    <label key={val} className="oma-filter-check">
                      <input
                        type="radio"
                        name="brand-filter"
                        checked={filter === val}
                        onChange={() => setFilter(val)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="oma-filter-accordion">
              <button
                type="button"
                className="oma-filter-accordion__row"
                data-open={filterSection === 'sort' ? 'true' : 'false'}
                onClick={() => setFilterSection((s) => (s === 'sort' ? null : 'sort'))}
              >
                <span className="oma-filter-accordion__ico">⇅</span>
                <span>{t('brand.list.sortLabel')}</span>
                <span className="oma-filter-accordion__caret">
                  {filterSection === 'sort' ? <UpOutlined /> : <DownOutlined />}
                </span>
              </button>
              {filterSection === 'sort' ? (
                <div className="oma-filter-accordion__body">
                  {(
                    [
                      ['updated', t('brand.list.sortUpdated')],
                      ['name', t('brand.list.sortName')],
                      ['status', t('brand.list.sortStatus')],
                    ] as const
                  ).map(([val, label]) => (
                    <label key={val} className="oma-filter-check">
                      <input
                        type="radio"
                        name="brand-sort"
                        checked={sortKey === val}
                        onChange={() => setSortKey(val)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <footer className="oma-req-filter-panel__foot">
            <Button
              type="default"
              onClick={() => {
                setQueryDraft('');
                setQuery('');
                setFilter('all');
                setSortKey('updated');
              }}
            >
              {t('brand.list.searchClear')}
            </Button>
            <Button
              type="primary"
              onClick={() => {
                setQuery(queryDraft.trim());
                setFilterSheet(false);
              }}
            >
              {t('brand.list.searchSubmit')}
            </Button>
          </footer>
        </aside>
      ) : null}
    </div>
  );
}
