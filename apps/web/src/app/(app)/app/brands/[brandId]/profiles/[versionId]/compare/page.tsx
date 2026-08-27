'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../../../lib/api';
import type { BrandDetail, ProfileDetail } from '../../../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../../../lib/use-locale';

type CompareResponse = {
  data: {
    left: ProfileDetail;
    right: ProfileDetail | null;
    diff: { field_key: string; left: unknown; right: unknown }[];
  };
};

export default function ProfileComparePage() {
  const t = useT();
  const params = useParams<{ brandId: string; versionId: string }>();
  const { brandId, versionId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [compare, setCompare] = useState<CompareResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
      api<CompareResponse>(`/api/v1/brands/${brandId}/profiles/${versionId}/compare`),
    ])
      .then(([brandRes, compareRes]) => {
        setBrand(brandRes.data);
        setCompare(compareRes.data);
      })
      .catch((err) => {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId, versionId]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <p role="status">{t('common.loading')}</p>;
  if (error || !brand || !compare) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)' }}>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <header className="oma-page-header">
        <h2>{t('brand.compare.title')}</h2>
        <Link href={`/app/brands/${brandId}/profiles/${versionId}`}>{t('brand.compare.back')}</Link>
      </header>

      {!compare.right ? (
        <div className="oma-card" role="status">
          <p>{t('brand.compare.noBaseline')}</p>
        </div>
      ) : compare.diff.length === 0 ? (
        <div className="oma-card" role="status">
          <p>{t('brand.compare.noChanges')}</p>
        </div>
      ) : (
        <div className="oma-compare-grid">
          <div className="oma-card">
            <h3>{t('brand.compare.current')}</h3>
            <p className="oma-muted">{compare.left.status}</p>
          </div>
          <div className="oma-card">
            <h3>{t('brand.compare.approved')}</h3>
            <p className="oma-muted">{compare.right.status}</p>
          </div>
        </div>
      )}

      {compare.diff.length > 0 ? (
        <table className="oma-compare-table">
          <caption className="oma-sr-only">{t('brand.compare.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('brand.compare.field')}</th>
              <th scope="col">{t('brand.compare.current')}</th>
              <th scope="col">{t('brand.compare.approved')}</th>
            </tr>
          </thead>
          <tbody>
            {compare.diff.map((row) => {
              const leftInsight = row.left as { text_value?: string; info_state?: string } | null;
              const rightInsight = row.right as { text_value?: string; info_state?: string };
              const changed = leftInsight?.text_value !== rightInsight?.text_value;
              return (
                <tr key={row.field_key} className={changed ? 'oma-compare-changed' : undefined}>
                  <th scope="row">{row.field_key}</th>
                  <td>
                    {leftInsight?.text_value ?? '—'}
                    {leftInsight?.info_state ? (
                      <span className="oma-badge oma-badge-muted">{leftInsight.info_state}</span>
                    ) : null}
                  </td>
                  <td>
                    {rightInsight?.text_value ?? '—'}
                    {rightInsight?.info_state ? (
                      <span className="oma-badge oma-badge-muted">{rightInsight.info_state}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </BrandWorkspaceShell>
  );
}
