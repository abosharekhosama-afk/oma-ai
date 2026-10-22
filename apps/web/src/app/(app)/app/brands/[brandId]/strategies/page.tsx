'use client';

import { OmaTopLoader } from '../../../../../../components/ui/oma-top-loader';
import { OmaLinkButton } from '../../../../../../components/ui/oma-link-button';

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
    return <OmaTopLoader label={t('common.loading')} />;
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
        <OmaLinkButton
          href={`/app/brands/${brandId}/strategies/new`}
          type="primary"
          data-testid="strategy-create"
        >
          {t('strategy.list.create')}
        </OmaLinkButton>
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
              <OmaLinkButton href={`/app/brands/${brandId}/strategies/new`} type="primary">
                {t('strategy.list.create')}
              </OmaLinkButton>
            }
          />
        </div>
      ) : (
        <Panel title={t('strategy.list.title')} labelledBy="strategy-list-heading">
          <div className="oma-workspace-grid" data-testid="strategy-list">
            {rows.map((row) => (
              <article key={row.id} className="oma-workspace-card">
                <Link
                  href={`/app/brands/${brandId}/strategies/${row.id}`}
                  className="oma-workspace-card-main"
                >
                  <span className="oma-brand-mark" aria-hidden="true">
                    S
                  </span>
                  <div className="oma-workspace-card-copy">
                    <h3>{row.name}</h3>
                    <div className="oma-chip-row">
                      <StatusChip status={row.status} />
                      {row.is_current ? (
                        <StatusChip tone="info" label={t('strategy.list.current')} />
                      ) : null}
                      {row.has_approved_version ? (
                        <StatusChip tone="success" label={t('strategy.list.hasApproved')} />
                      ) : null}
                    </div>
                    <p className="oma-workspace-card-meta">
                      <time dateTime={row.updated_at} suppressHydrationWarning>
                        {new Date(row.updated_at).toLocaleString()}
                      </time>
                    </p>
                  </div>
                </Link>
                <OmaLinkButton
                  href={`/app/brands/${brandId}/strategies/${row.id}`}
                  type="primary"
                  size="small"
                >
                  {t('home.action.open')}
                </OmaLinkButton>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </BrandWorkspaceShell>
  );
}
