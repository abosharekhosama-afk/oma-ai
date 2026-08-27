'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import {
  apiMutate,
  getApiError,
  isPermissionDenied,
  newIdempotencyKey,
} from '../../../../../../lib/brand-api';
import type { BrandDetail } from '../../../../../../lib/brand-types';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../lib/use-locale';

export default function ConnectWebsitePage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [url, setUrl] = useState('');
  const [attested, setAttested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then((res) => {
        setBrand(res.data);
        if (res.data.website) setUrl(res.data.website.normalized_url);
      })
      .catch((err) => {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brand) return;
    setBusy(true);
    setError(null);
    try {
      await apiMutate(`/api/v1/brands/${brandId}/website`, {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(),
          authorization_attested: attested,
          version: brand.version,
        }),
        idempotencyKey: newIdempotencyKey('brand:website'),
      });
      router.push(`/app/brands/${brandId}`);
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

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <div style={{ maxWidth: 520 }}>
        <h2>{t('brand.connect.title')}</h2>
        <p className="oma-muted">{t('brand.connect.hint')}</p>
        <form className="oma-card" onSubmit={onSubmit}>
          <label htmlFor="website-url">{t('brand.connect.urlLabel')}</label>
          <input
            id="website-url"
            type="url"
            className="oma-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            autoFocus
          />
          <label htmlFor="attestation" className="oma-checkbox-label">
            <input
              id="attestation"
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              required
            />{' '}
            {t('brand.connect.attestation')}
          </label>
          {error ? (
            <p role="alert" style={{ color: 'var(--status-danger)' }}>
              {error}
            </p>
          ) : null}
          <div className="oma-form-actions">
            <button className="oma-btn" type="submit" disabled={busy || !attested || !url.trim()}>
              {t('brand.connect.submit')}
            </button>
            <Link href={`/app/brands/${brandId}`}>{t('common.cancel')}</Link>
          </div>
        </form>
      </div>
    </BrandWorkspaceShell>
  );
}
