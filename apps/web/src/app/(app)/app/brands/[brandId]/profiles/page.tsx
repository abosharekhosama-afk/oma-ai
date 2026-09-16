'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail, Paginated } from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { useLocale, useT } from '../../../../../../lib/use-locale';

type ProfileVersionSummary = {
  id: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  scan_attempt_id: string | null;
  ai_availability: string;
};

export default function BrandProfileVersionsPage() {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [versions, setVersions] = useState<ProfileVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [brandRes, versionsRes] = await Promise.all([
          api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
          api<Paginated<ProfileVersionSummary>>(`/api/v1/brands/${brandId}/profiles`),
        ]);
        setBrand(brandRes.data);
        setVersions(versionsRes.data);
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
        <Link href="/app/brands">{t('brand.create.back')}</Link>
      </div>
    );
  }

  const approvedId = brand.current_approved_profile_version_id;

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <header className="oma-page-header">
        <h2>{t('brand.versions.title')}</h2>
        <p className="oma-muted">{t('brand.versions.hint')}</p>
      </header>

      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)' }}>{error}</p>
        </div>
      ) : versions.length === 0 ? (
        <div className="oma-card" role="status">
          <p>{t('brand.versions.empty')}</p>
          <Link href={`/app/brands/${brandId}/scans/new`} className="oma-btn">
            {t('brand.scan.start')}
          </Link>
        </div>
      ) : (
        <ul className="oma-discovery-list">
          {versions.map((version) => (
            <li key={version.id} className="oma-discovery-item">
              <div>
                <strong>
                  <Link href={`/app/brands/${brandId}/profiles/${version.id}`}>
                    {t('brand.profile.title')}
                  </Link>
                </strong>
                <span className="oma-badge">{version.status}</span>
                {version.id === approvedId ? (
                  <span className="oma-badge oma-badge-muted">{t('brand.versions.current')}</span>
                ) : null}
                {version.ai_availability !== 'AVAILABLE' ? (
                  <span className="oma-badge oma-badge-muted">
                    {t('brand.versions.aiUnavailable')}
                  </span>
                ) : null}
              </div>
              <p className="oma-muted" style={{ fontSize: 14, margin: '0.25rem 0' }}>
                {t('brand.versions.created')}: {new Date(version.created_at).toLocaleString(locale)}
                {version.approved_at
                  ? ` · ${t('brand.versions.approved')}: ${new Date(
                      version.approved_at,
                    ).toLocaleString(locale)}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </BrandWorkspaceShell>
  );
}
