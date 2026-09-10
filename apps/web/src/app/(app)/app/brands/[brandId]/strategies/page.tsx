'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../lib/brand-types';
import type { StrategyListItem } from '../../../../../../lib/strategy-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { useT } from '../../../../../../lib/use-locale';
import { StatusChip } from '../../../../../../components/ui/status-chip';
import { EmptyState, ErrorState, Skeleton } from '../../../../../../components/ui/empty-state';
import { Panel } from '../../../../../../components/ui/page-header';

export default function StrategiesListPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [rows, setRows] = useState<StrategyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [brandRes, listRes] = await Promise.all([
          api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
          api<{ data: StrategyListItem[] }>(`/api/v1/brands/${brandId}/strategies`),
        ]);
        setBrand(brandRes.data);
        setRows(listRes.data);
      } catch (err) {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [brandId]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (loading) {
    return (
      <div className="oma-stack" role="status" aria-label={t('common.loading')}>
        <Skeleton height="8rem" />
      </div>
    );
  }
  if (!brand) {
    return <ErrorState title={t('common.error')} body={error ?? t('common.notFound')} />;
  }

  const missingProfile = !brand.current_approved_profile_version_id;

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      websiteUrl={brand.website?.normalized_url}
      brandStatus={brand.status}
    >
      <header className="oma-page-header">
        <div>
          <h2>{t('strategy.list.title')}</h2>
          <p className="oma-muted">{t('strategy.list.hint')}</p>
        </div>
        <Link
          href={`/app/brands/${brandId}/strategies/new`}
          className="oma-btn"
          data-testid="strategy-create"
        >
          {t('strategy.list.create')}
        </Link>
      </header>

      {missingProfile ? (
        <div className="oma-banner-demo" role="status">
          <span>{t('strategy.list.missingProfile')}</span>
          <Link href={`/app/brands/${brandId}/profiles`} className="oma-text-link">
            {t('brand.detail.intelligenceCta')}
          </Link>
        </div>
      ) : null}

      {error ? <ErrorState title={t('common.error')} body={error} /> : null}

      {rows.length === 0 ? (
        <div data-testid="strategy-empty">
          <EmptyState
            title={t('strategy.list.empty')}
            action={
              <Link href={`/app/brands/${brandId}/strategies/new`} className="oma-btn">
                {t('strategy.list.create')}
              </Link>
            }
          />
        </div>
      ) : (
        <Panel title={t('strategy.list.title')} labelledBy="strategy-list-heading">
          <div className="oma-table-wrap">
            <table className="oma-table oma-portfolio-table" data-testid="strategy-list">
              <thead>
                <tr>
                  <th scope="col">{t('strategy.list.col.name')}</th>
                  <th scope="col">{t('strategy.list.col.status')}</th>
                  <th scope="col">{t('strategy.list.col.current')}</th>
                  <th scope="col">{t('strategy.list.col.updated')}</th>
                  <th scope="col">{t('strategy.list.col.action')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label={t('strategy.list.col.name')}>
                      <Link
                        href={`/app/brands/${brandId}/strategies/${row.id}`}
                        className="oma-table-primary"
                      >
                        {row.name}
                      </Link>
                      <div className="oma-chip-row">
                        {row.has_approved_version ? (
                          <StatusChip tone="success" label={t('strategy.list.hasApproved')} />
                        ) : null}
                      </div>
                    </td>
                    <td data-label={t('strategy.list.col.status')}>
                      <StatusChip status={row.status} />
                    </td>
                    <td data-label={t('strategy.list.col.current')}>
                      {row.is_current ? (
                        <StatusChip tone="info" label={t('strategy.list.current')} />
                      ) : (
                        <span className="oma-muted">—</span>
                      )}
                    </td>
                    <td data-label={t('strategy.list.col.updated')}>
                      <time dateTime={row.updated_at}>
                        {new Date(row.updated_at).toLocaleString()}
                      </time>
                    </td>
                    <td data-label={t('strategy.list.col.action')}>
                      <Link
                        href={`/app/brands/${brandId}/strategies/${row.id}`}
                        className="oma-btn oma-btn-compact"
                      >
                        {t('home.action.open')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </BrandWorkspaceShell>
  );
}
