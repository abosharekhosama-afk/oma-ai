'use client';
import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { Button, CheckboxField } from '@oma/ui/controls';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../../lib/api';
import {
  apiMutate,
  getApiError,
  isPermissionDenied,
  newIdempotencyKey,
} from '../../../../../../../lib/brand-api';
import type { BrandDetail } from '../../../../../../../lib/brand-types';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { ConnectorModeBanner } from '../../../../../../../components/brand/connector-mode-banner';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../../lib/use-locale';

const DEFAULT_BOUNDS = {
  max_pages: 50,
  max_depth: 3,
  max_duration_seconds: 600,
};

export default function NewScanPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then((res) => setBrand(res.data))
      .catch((err) => {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiMutate<{ data: { scan_attempt_id: string } }>(
        `/api/v1/brands/${brandId}/scans`,
        {
          method: 'POST',
          body: JSON.stringify({ trigger: 'START', config: DEFAULT_BOUNDS }),
          idempotencyKey: newIdempotencyKey('brand:scan'),
        },
      );
      router.push(`/app/brands/${brandId}/scans/${res.data.scan_attempt_id}`);
    } catch (err) {
      if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <p role="status">{t('common.loading')}</p>;
  if (!brand) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)' }}>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  if (!brand.website) {
    return (
      <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
        <div className="oma-card" role="status">
          <p>{t('brand.scan.noWebsite')}</p>
          <OmaLinkButton href={`/app/brands/${brandId}/connect`} type="primary">
            {t('brand.detail.connectCta')}
          </OmaLinkButton>
        </div>
      </BrandWorkspaceShell>
    );
  }

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      brandStatus={brand.status}
      websiteUrl={brand.website?.normalized_url}
    >
      <div className="oma-panel" style={{ maxWidth: 520 }}>
        <ConnectorModeBanner mode={brand.next_scan_connector_mode} />
        <h2>{t('brand.scan.setupTitle')}</h2>
        <p className="oma-muted">{t('brand.scan.setupHint')}</p>
        <div className="oma-scan-bounds" aria-labelledby="scan-bounds-title">
          <h3 id="scan-bounds-title">{t('brand.scan.boundsTitle')}</h3>
          <dl className="oma-detail-dl">
            <div>
              <dt>{t('brand.scan.maxPages')}</dt>
              <dd>{DEFAULT_BOUNDS.max_pages}</dd>
            </div>
            <div>
              <dt>{t('brand.scan.maxDepth')}</dt>
              <dd>{DEFAULT_BOUNDS.max_depth}</dd>
            </div>
            <div>
              <dt>{t('brand.scan.maxDuration')}</dt>
              <dd>
                {DEFAULT_BOUNDS.max_duration_seconds} {t('brand.scan.seconds')}
              </dd>
            </div>
          </dl>
        </div>
        <form onSubmit={onSubmit}>
          <label htmlFor="scan-confirm" className="oma-checkbox-label">
            <CheckboxField
              id="scan-confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{' '}
            {t('brand.scan.confirmBounds')}
          </label>
          {error ? (
            <p role="alert" style={{ color: 'var(--status-danger)' }}>
              {error}
            </p>
          ) : null}
          <div className="oma-form-actions">
            <Button type="primary" disabled={busy || !confirmed} htmlType="submit">
              {t('brand.scan.start')}
            </Button>
            <Link href={`/app/brands/${brandId}`}>{t('common.cancel')}</Link>
          </div>
        </form>
      </div>
    </BrandWorkspaceShell>
  );
}
