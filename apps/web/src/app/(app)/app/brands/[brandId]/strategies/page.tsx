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
  if (loading) return <p role="status">{t('common.loading')}</p>;
  if (!brand) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)' }}>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
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
      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)' }}>{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="oma-card" role="status" data-testid="strategy-empty">
          <p>{t('strategy.list.empty')}</p>
          <Link href={`/app/brands/${brandId}/strategies/new`} className="oma-btn">
            {t('strategy.list.create')}
          </Link>
        </div>
      ) : (
        <ul className="oma-discovery-list" data-testid="strategy-list">
          {rows.map((row) => (
            <li key={row.id} className="oma-card oma-discovery-item">
              <div>
                <strong>
                  <Link href={`/app/brands/${brandId}/strategies/${row.id}`}>{row.name}</Link>
                </strong>
                <StatusChip status={row.status} />
                {row.is_current ? (
                  <span className="oma-badge oma-badge-muted">{t('strategy.list.current')}</span>
                ) : null}
                {row.has_approved_version ? (
                  <span className="oma-badge">{t('strategy.list.hasApproved')}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </BrandWorkspaceShell>
  );
}
