'use client';

import { useState } from 'react';
import { Button, SelectField } from '@oma/ui/controls';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import type { CatalogProductMedia, DiscoveredProduct } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';

type GenerateKind = 'image' | 'video' | 'short_video';

type Props = {
  brandId: string;
  product: DiscoveredProduct;
  profileApproved: boolean;
  onUpdated: () => void;
};

function isUsableForPreview(m: CatalogProductMedia) {
  return m.review_status !== 'REJECTED' && (m.review_status === 'APPROVED' || m.role.startsWith('SCAN_'));
}

export function CatalogProductActions({ brandId, product, profileApproved, onUpdated }: Props) {
  const t = useT();
  const [kind, setKind] = useState<GenerateKind>('image');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const media = product.media ?? [];
  const thumbnail =
    media.find((m) => isUsableForPreview(m) && m.role === 'SCAN_THUMBNAIL') ??
    media.find((m) => isUsableForPreview(m) && m.mime.startsWith('image/')) ??
    media.find((m) => isUsableForPreview(m) && m.mime.startsWith('video/'));

  const pendingGenerated = media.filter(
    (m) => m.review_status === 'PENDING' && m.role.startsWith('GENERATED_'),
  );

  async function generate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{
        data: { generated: number; queued?: boolean; job_id?: string };
      }>(`/api/v1/brands/${brandId}/catalog/products/${product.id}/generate`, {
        method: 'POST',
        body: JSON.stringify({ kind }),
      });
      if (res.data.queued) {
        setMessage(t('brand.catalog.queuedVideo'));
        window.setTimeout(() => onUpdated(), 8000);
      } else {
        setMessage(
          t('brand.catalog.generatedCount').replace('{count}', String(res.data.generated)),
        );
        onUpdated();
      }
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function review(linkId: string, decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/brands/${brandId}/catalog/media/${linkId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      onUpdated();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oma-catalog-product-media" data-testid={`catalog-product-${product.id}`}>
      {thumbnail ? (
        <div className="oma-catalog-product-media__preview">
          {thumbnail.mime.startsWith('video/') ? (
            <video
              src={thumbnail.stream_url ?? thumbnail.view_url}
              controls
              playsInline
              className="oma-catalog-product-media__thumb"
            />
          ) : (
            <img
              src={thumbnail.view_url}
              alt=""
              className="oma-catalog-product-media__thumb"
              loading="lazy"
            />
          )}
        </div>
      ) : (
        <p className="oma-muted oma-catalog-product-media__empty">{t('brand.catalog.noMedia')}</p>
      )}
      {media.length > 1 ? (
        <p className="oma-muted" style={{ fontSize: 12 }}>
          {t('brand.catalog.mediaCount').replace('{count}', String(media.length))}
        </p>
      ) : null}
      {pendingGenerated.length > 0 ? (
        <ul className="oma-catalog-product-media__pending" data-testid="catalog-pending-review">
          {pendingGenerated.map((m) => (
            <li key={m.id} className="oma-stack" style={{ marginTop: 8 }}>
              <span className="oma-badge oma-badge-warning">{t('brand.catalog.pendingReview')}</span>
              {m.mime.startsWith('video/') ? (
                <video
                  src={m.stream_url ?? m.view_url}
                  controls
                  playsInline
                  className="oma-catalog-product-media__thumb"
                />
              ) : (
                <img src={m.view_url} alt="" className="oma-catalog-product-media__thumb" loading="lazy" />
              )}
              <div className="oma-form-actions">
                <Button type="primary" disabled={busy} onClick={() => void review(m.id, 'approve')}>
                  {t('brand.catalog.approve')}
                </Button>
                <Button type="default" disabled={busy} onClick={() => void review(m.id, 'reject')}>
                  {t('brand.catalog.reject')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {profileApproved ? (
        <div className="oma-catalog-product-media__actions" data-testid="catalog-generate-actions">
          <label className="oma-field oma-field-inline">
            <span>{t('brand.catalog.generateKind')}</span>
            <SelectField
              value={kind}
              onChange={(e) => setKind(e.target.value as GenerateKind)}
              disabled={busy}
              data-testid="catalog-generate-kind"
            >
              <option value="image">{t('brand.catalog.kindImage')}</option>
              <option value="video">{t('brand.catalog.kindVideo')}</option>
              <option value="short_video">{t('brand.catalog.kindShortVideo')}</option>
            </SelectField>
          </label>
          <Button type="primary" disabled={busy || !thumbnail} onClick={() => void generate()}>
            {t('brand.catalog.generate')}
          </Button>
        </div>
      ) : (
        <p className="oma-muted" role="status">
          {t('brand.catalog.generateAfterProfile')}
        </p>
      )}
      {message ? <p role="status">{message}</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CatalogMediaGallery({ media }: { media: CatalogProductMedia[] }) {
  if (!media.length) return null;
  return (
    <ul className="oma-catalog-product-media__gallery">
      {media.map((m) => (
        <li key={m.id} className="oma-catalog-product-media__gallery-item">
          {m.mime.startsWith('video/') ? (
            <video src={m.stream_url ?? m.view_url} controls playsInline />
          ) : (
            <img src={m.view_url} alt="" loading="lazy" />
          )}
          <span className="oma-badge oma-badge-muted">{m.role}</span>
        </li>
      ))}
    </ul>
  );
}