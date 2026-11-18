'use client';

import Link from 'next/link';
import { Button, CheckboxField } from '@oma/ui/controls';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import type { DiscoveredProduct, ProfileDetail } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';
import { statusLabel } from '../ui/status-chip';

const EDITABLE_PROFILE = new Set(['DRAFT', 'NEEDS_REVIEW']);

export function DiscoveryCatalogMergeBar({
  brandId,
  scanId,
  products,
  profile,
  latestProfileStatus,
  onMerged,
}: {
  brandId: string;
  scanId: string;
  products: DiscoveredProduct[];
  profile: ProfileDetail | null;
  /** When profile is not loaded (e.g. APPROVED), still show the correct blocker message. */
  latestProfileStatus?: string | null;
  onMerged: () => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(products.map((p) => p.id)));
  const [acceptInsights, setAcceptInsights] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editableProfile = profile && EDITABLE_PROFILE.has(profile.status);
  const allSelected = products.length > 0 && selected.size === products.length;

  const selectionLabel = useMemo(
    () => t('brand.discovery.mergeSelectedCount').replace('{count}', String(selected.size)),
    [selected.size, t],
  );

  if (products.length === 0) return null;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function merge() {
    if (!profile || !editableProfile || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{
        data: { merged_item_count: number; profile: ProfileDetail };
      }>(`/api/v1/brands/${brandId}/profiles/${profile.id}/catalog/merge-discovery`, {
        method: 'POST',
        body: JSON.stringify({
          row_version: profile.row_version,
          scan_id: scanId,
          discovery_item_ids: [...selected],
          accept_catalog_insights: acceptInsights,
        }),
      });
      setMessage(
        t('brand.discovery.mergeSuccess').replace('{count}', String(res.data.merged_item_count)),
      );
      onMerged();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const profileLocked =
    !editableProfile && (latestProfileStatus === 'APPROVED' || profile?.status === 'APPROVED');

  return (
    <details className="oma-discovery-merge" open data-testid="discovery-catalog-merge">
      <summary className="oma-discovery-merge__summary">
        <strong>{t('brand.discovery.mergeTitle')}</strong>
        {editableProfile ? <span className="oma-muted">{selectionLabel}</span> : null}
      </summary>
      <div className="oma-discovery-merge__body">
        <p className="oma-muted">{t('brand.discovery.mergeHint')}</p>

        {profileLocked ? (
          <div className="oma-stack" role="status">
            <p>{t('brand.discovery.mergeProfileLocked')}</p>
            <Link href={`/app/brands/${brandId}/profiles`} className="oma-text-link">
              {t('brand.discovery.openProfilesList')}
            </Link>
          </div>
        ) : !profile ? (
          <div className="oma-stack" role="status">
            <p>{t('brand.discovery.mergeNoProfile')}</p>
            <Link href={`/app/brands/${brandId}/profiles`} className="oma-text-link">
              {t('brand.discovery.openProfilesList')}
            </Link>
          </div>
        ) : !editableProfile ? (
          <p role="status">{t('brand.discovery.mergeProfileLocked')}</p>
        ) : (
          <>
            <label className="oma-chip-row">
              <CheckboxField checked={allSelected} onChange={() => toggleAll()} />
              {t('brand.discovery.selectAll')}
            </label>
            <ul className="oma-discovery-list">
              {products.map((product) => (
                <li key={product.id} className="oma-discovery-item">
                  <label className="oma-chip-row">
                    <CheckboxField
                      checked={selected.has(product.id)}
                      onChange={() => toggleOne(product.id)}
                    />
                    <span>
                      {product.name}{' '}
                      <span className="oma-badge oma-badge-muted">
                        {statusLabel(t, product.kind)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="oma-chip-row">
              <CheckboxField
                checked={acceptInsights}
                onChange={(e) => setAcceptInsights(e.target.checked)}
              />
              {t('brand.discovery.mergeAcceptCatalog')}
            </label>
            <div className="oma-form-actions">
              <Button
                type="primary"
                disabled={busy || selected.size === 0}
                onClick={() => void merge()}
              >
                {busy ? t('brand.discovery.merging') : t('brand.discovery.mergeCta')}
              </Button>
              <Link
                href={`/app/brands/${brandId}/profiles/${profile.id}`}
                className="oma-text-link"
              >
                {t('brand.discovery.openProfile')}
              </Link>
            </div>
          </>
        )}

        {message ? <p role="status">{message}</p> : null}
        {error ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
