'use client';

import {
  SearchOutlined,
  DownOutlined,
  UpOutlined,
  UnorderedListOutlined,
} from '../../../../components/ui/lucide-icons';
import { OmaLinkButton } from '../../../../components/ui/oma-link-button';
import { Button, Input } from '@oma/ui/controls';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../lib/api';
import type { BrandListItem, Paginated } from '../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../lib/brand-api';
import { PermissionDenied } from '../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../components/shell/select-company';
import { useT } from '../../../../lib/use-locale';
import { WorkspaceCard } from '../../../../components/brand/workspace-card';
import { brandAttention } from '../../../../lib/brand-attention';
import { ErrorState } from '../../../../components/ui/empty-state';
import { BrandsShimmer } from '../../../../components/ui/screen-shimmer';
import { PlxHeaderFilter } from '../../../../components/ui/plx-header-filter';

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
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const sync = () => {
      if (cancelled) return;
      const header = document.getElementById('oma-workspace-top-actions');
      setHeaderSlot(header);
      tries += 1;
      if (!header && tries < 30) {
        window.setTimeout(sync, 50);
      }
    };
    sync();
    return () => {
      cancelled = true;
      setHeaderSlot(null);
    };
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
      const au = a.updated_at || '';
      const bu = b.updated_at || '';
      return bu.localeCompare(au);
    });
    return rows;
  }, [brands, filter, sortKey]);

  const activeFilterCount =
    (query ? 1 : 0) + (filter !== 'all' ? 1 : 0) + (sortKey !== 'updated' ? 1 : 0);

  if (tenantRequired) return <SelectCompany />;
  if (denied) return <PermissionDenied />;

  const filterLabel = t('brand.list.filterLabel');
  const filterPanelTitle = t('brand.list.filterLabel');

  return (
    <div
      className="oma-plx-listening oma-plx-brand-portfolio"
      data-testid="brand-portfolio"
      data-surface="brands"
      data-filter-open={filterSheet ? 'true' : 'false'}
    >
      <PlxHeaderFilter
        headerSlot={headerSlot}
        open={filterSheet}
        onOpenChange={setFilterSheet}
        filterTestId="brand-open-filters"
        filterLabel={filterLabel}
        filterCount={activeFilterCount}
        panelTitle={filterPanelTitle}
        panelTestId="brand-filter-panel"
        headerLeading={
          <OmaLinkButton
            href="/app/brands/new"
            type="primary"
            className="oma-plx-tasks__create-icon"
            data-testid="shell-create-brand"
          >
            {t('brand.list.create')}
          </OmaLinkButton>
        }
        footer={
          <>
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
          </>
        }
      >
        <div className="oma-filter-accordion-list oma-plx-deliv-filter-accordion-list">
          <div className="oma-filter-accordion">
            <button
              type="button"
              className="oma-filter-accordion__row"
              data-open={filterSection === 'search' ? 'true' : 'false'}
              onClick={() => setFilterSection((s) => (s === 'search' ? null : 'search'))}
            >
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
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
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
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
              <span className="oma-filter-accordion__ico oma-plx-deliv-filter-accordion__ico">
                ⇅
              </span>
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
      </PlxHeaderFilter>

      <div className="oma-plx-workspace-surface">
        <div className="oma-plx-listening__intro oma-plx-deliv__intro">
          <div>
            <p className="oma-plx-brand-portfolio__kicker">{t('brand.list.kicker')}</p>
            <h1 className="oma-plx-listening__title">{t('brand.list.title')}</h1>
            <p className="oma-plx-deliv__subtitle">{t('brand.list.subtitle')}</p>
          </div>
          {!loading && !error ? (
            <p className="oma-plx-listening__next-check">{visible.length}</p>
          ) : null}
        </div>

        {error ? <ErrorState title={t('common.error')} body={error} /> : null}

        {loading ? (
          <BrandsShimmer part="body" />
        ) : visible.length === 0 && query ? (
          <div className="oma-ws-empty-block oma-plx-brand-empty">
            <strong>{t('brand.list.noResults')}</strong>
          </div>
        ) : visible.length === 0 ? (
          <div className="oma-ws-empty-block oma-plx-brand-empty">
            <strong>{t('brand.list.emptyTitle')}</strong>
            <p>{t('brand.list.emptyBody')}</p>
            <div style={{ marginTop: 16 }}>
              <OmaLinkButton href="/app/brands/new" type="primary">
                {t('brand.list.create')}
              </OmaLinkButton>
            </div>
          </div>
        ) : (
          <section className="oma-plx-listening-panel oma-plx-brand-portfolio-panel">
            <div className="oma-plx-deliv-panel__body">
              <div className="oma-plx-brand-card-grid" data-testid="brand-workspace-grid">
                {visible.map((brand) => (
                  <WorkspaceCard key={brand.id} brand={brand} />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
