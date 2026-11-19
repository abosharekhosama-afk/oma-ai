'use client';
import { DetailShimmer } from '../../../../../../components/ui/shimmer';

import { OmaLinkButton } from '../../../../../../components/ui/oma-link-button';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail, Paginated } from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import {
  ProfileVersionCard,
  type ProfileVersionCardModel,
} from '../../../../../../components/brand/profile-version-card';
import { BrandPlxPageHead } from '../../../../../../components/brand/brand-plx-section';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { useT } from '../../../../../../lib/use-locale';

export default function BrandProfileVersionsPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [versions, setVersions] = useState<ProfileVersionCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [brandRes, versionsRes] = await Promise.all([
          api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`),
          api<Paginated<ProfileVersionCardModel>>(`/api/v1/brands/${brandId}/profiles`),
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
  if (loading) return <DetailShimmer />;
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
      <BrandPlxPageHead title={t('brand.versions.title')} description={t('brand.versions.hint')} />

      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)' }}>{error}</p>
        </div>
      ) : versions.length === 0 ? (
        <div className="oma-plx-listening-panel oma-brand-empty" role="status">
          <p>{t('brand.versions.empty')}</p>
          <OmaLinkButton href={`/app/brands/${brandId}/scans/new`} type="primary">
            {t('brand.scan.start')}
          </OmaLinkButton>
        </div>
      ) : (
        <ul className="oma-profile-version-grid" data-testid="profile-version-cards">
          {versions.map((version) => (
            <ProfileVersionCard
              key={version.id}
              brandId={brandId}
              version={version}
              isApprovedCurrent={version.id === approvedId}
              approvedProfileId={approvedId}
            />
          ))}
        </ul>
      )}
    </BrandWorkspaceShell>
  );
}
