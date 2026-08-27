'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../lib/api';
import type { BrandDetail } from '../../../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';
import { useT } from '../../../../../lib/use-locale';

export default function BrandDetailPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then((res) => setBrand(res.data))
      .catch((err) => {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <p role="status">{t('common.loading')}</p>;
  if (error || !brand) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)' }}>{error ?? t('common.notFound')}</p>
        <Link href="/app/brands">{t('brand.create.back')}</Link>
      </div>
    );
  }

  const scan = brand.latest_scan;

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <div className="oma-card">
        <h2>{t('brand.detail.overview')}</h2>
        <dl className="oma-detail-dl">
          <div>
            <dt>{t('brand.detail.status')}</dt>
            <dd>
              <span className="oma-badge">{brand.status}</span>
            </dd>
          </div>
          <div>
            <dt>{t('brand.detail.website')}</dt>
            <dd>
              {brand.website ? (
                <a href={brand.website.normalized_url}>{brand.website.normalized_url}</a>
              ) : (
                <Link href={`/app/brands/${brandId}/connect`}>{t('brand.detail.connectCta')}</Link>
              )}
            </dd>
          </div>
          <div>
            <dt>{t('brand.detail.latestScan')}</dt>
            <dd>
              {scan ? (
                <Link href={`/app/brands/${brandId}/scans/${scan.id}`}>{scan.status}</Link>
              ) : (
                t('brand.detail.noScan')
              )}
            </dd>
          </div>
          {brand.current_approved_profile_version_id ? (
            <div>
              <dt>{t('brand.detail.approvedProfile')}</dt>
              <dd>
                <Link
                  href={`/app/brands/${brandId}/profiles/${brand.current_approved_profile_version_id}`}
                >
                  {t('brand.detail.viewProfile')}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="oma-action-grid">
        {!brand.website ? (
          <Link href={`/app/brands/${brandId}/connect`} className="oma-card oma-action-card">
            <strong>{t('brand.detail.connectCta')}</strong>
            <p className="oma-muted">{t('brand.detail.connectHint')}</p>
          </Link>
        ) : (
          <Link href={`/app/brands/${brandId}/scans/new`} className="oma-card oma-action-card">
            <strong>{t('brand.nav.scan')}</strong>
            <p className="oma-muted">{t('brand.scan.setupHint')}</p>
          </Link>
        )}
        {scan ? (
          <>
            <Link
              href={`/app/brands/${brandId}/discovery/pages`}
              className="oma-card oma-action-card"
            >
              <strong>{t('brand.discovery.pagesTitle')}</strong>
            </Link>
            <Link
              href={`/app/brands/${brandId}/discovery/products`}
              className="oma-card oma-action-card"
            >
              <strong>{t('brand.discovery.productsTitle')}</strong>
            </Link>
          </>
        ) : null}
      </div>
    </BrandWorkspaceShell>
  );
}
