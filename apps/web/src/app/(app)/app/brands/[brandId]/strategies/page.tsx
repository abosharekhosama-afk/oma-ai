'use client';
import { DetailShimmer } from '../../../../../../components/ui/shimmer';

import { OmaLinkButton } from '../../../../../../components/ui/oma-link-button';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail } from '../../../../../../lib/brand-types';
import type { StrategyListItem } from '../../../../../../lib/strategy-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { useLocale, useT } from '../../../../../../lib/use-locale';
import { StatusChip } from '../../../../../../components/ui/status-chip';
import { EmptyState, ErrorState } from '../../../../../../components/ui/empty-state';
import { BrandPlxPageHead } from '../../../../../../components/brand/brand-plx-section';
import { formatBrandDateTime } from '../../../../../../lib/brand-format';

export default function StrategiesListPage() {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [rows, setRows] = useState<StrategyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  // Current strategy first, then most recently updated.
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          Number(b.is_current) - Number(a.is_current) || b.updated_at.localeCompare(a.updated_at),
      ),
    [rows],
  );

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
    return <DetailShimmer />;
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
      brandLogoUrl={brand.logo_url}
      brandStatus={brand.status}
      latestScanId={brand.latest_scan?.id}
    >
      <BrandPlxPageHead
        title={t('strategy.list.title')}
        description={t('strategy.list.hint')}
        actions={
          <OmaLinkButton
            href={`/app/brands/${brandId}/strategies/new`}
            type="primary"
            data-testid="strategy-create"
          >
            {t('strategy.list.create')}
          </OmaLinkButton>
        }
      />

      {missingProfile ? (
        <div className="oma-banner oma-banner-warning" role="status">
          <span>{t('strategy.list.missingProfile')}</span>{' '}
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
            body={missingProfile ? undefined : t('strategy.list.readyToCreate')}
          />
        </div>
      ) : (
        <ul className="oma-strategy-card-grid" data-testid="strategy-list">
          {sorted.map((row) => (
            <li key={row.id}>
              <Link
                href={`/app/brands/${brandId}/strategies/${row.id}`}
                className={`oma-plx-listening-card oma-strategy-card${
                  row.is_current ? ' is-current' : ''
                }`}
                data-testid={row.is_current ? 'strategy-list-current' : undefined}
              >
                <div className="oma-strategy-card__head">
                  <span className="oma-strategy-card__avatar" aria-hidden="true">
                    {row.name.trim().charAt(0).toUpperCase() || '·'}
                  </span>
                  <div className="oma-strategy-card__title">
                    <strong dir="auto">{row.name}</strong>
                    <time dateTime={row.updated_at} suppressHydrationWarning className="oma-muted">
                      {t('strategy.list.updatedAt').replace(
                        '{date}',
                        formatBrandDateTime(row.updated_at, locale),
                      )}
                    </time>
                  </div>
                </div>
                <div className="oma-chip-row">
                  <StatusChip status={row.status} />
                  {row.is_current ? (
                    <StatusChip tone="info" label={t('strategy.list.current')} />
                  ) : null}
                  {row.has_approved_version ? (
                    <StatusChip tone="success" label={t('strategy.list.hasApproved')} />
                  ) : (
                    <StatusChip tone="warning" label={t('strategy.list.noApprovedVersion')} />
                  )}
                </div>
                <span className="oma-plx-brand-hub-card__foot">
                  <span>{t('home.action.open')}</span>
                  <span className="oma-plx-brand-hub-card__arrow" aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BrandWorkspaceShell>
  );
}
