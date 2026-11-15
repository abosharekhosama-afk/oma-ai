'use client';

import { useState, type ReactNode } from 'react';
import { Button, SelectField } from '@oma/ui/controls';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import type { DiscoveredProduct } from '../../lib/brand-types';
import { pendingGeneratedMedia, productGallery } from '../../lib/product-media';
import { useT } from '../../lib/use-locale';

type GenerateKind = 'image' | 'video' | 'short_video';

type Props = {
  brandId: string;
  product: DiscoveredProduct;
  profileApproved: boolean;
  onUpdated: () => void;
  /** Kept for call-site compatibility; the card always renders media in its carousel. */
  compact?: boolean;
  /** Extra action rendered at the end of the action row (e.g. "View evidence"). */
  trailing?: ReactNode;
};

/** Generate-from-product + human review of generated media. Media itself lives in the card carousel. */
export function CatalogProductActions({
  brandId,
  product,
  profileApproved,
  onUpdated,
  trailing,
}: Props) {
  const t = useT();
  const [kind, setKind] = useState<GenerateKind>('image');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSourceMedia = productGallery(product.media).some((m) => !m.generated);
  const pendingGenerated = pendingGeneratedMedia(product.media);

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
      {pendingGenerated.length > 0 ? (
        <section
          className="oma-catalog-product-media__pending"
          data-testid="catalog-pending-review"
          aria-label={t('brand.catalog.pendingReview')}
        >
          <span className="oma-badge oma-badge-warning">
            {t('brand.catalog.pendingReviewCount').replace(
              '{count}',
              String(pendingGenerated.length),
            )}
          </span>
          <ul className="oma-catalog-product-media__pending-list">
            {pendingGenerated.map((m) => (
              <li key={m.id} className="oma-catalog-product-media__pending-item">
                {m.mime.startsWith('video/') ? (
                  <video
                    src={m.stream_url ?? m.view_url}
                    controls
                    playsInline
                    preload="metadata"
                    className="oma-catalog-product-media__thumb"
                  />
                ) : (
                  <img
                    src={m.view_url}
                    alt={`${product.name} — ${t('brand.catalog.pendingReview')}`}
                    className="oma-catalog-product-media__thumb"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="oma-catalog-product-media__pending-actions">
                  <Button
                    type="primary"
                    size="small"
                    disabled={busy}
                    onClick={() => void review(m.id, 'approve')}
                  >
                    {t('brand.catalog.approve')}
                  </Button>
                  <Button
                    type="default"
                    size="small"
                    disabled={busy}
                    onClick={() => void review(m.id, 'reject')}
                  >
                    {t('brand.catalog.reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="oma-catalog-product-media__actions" data-testid="catalog-generate-actions">
        {profileApproved ? (
          <>
            <label className="oma-catalog-product-media__kind">
              <span className="oma-sr-only">{t('brand.catalog.generateKind')}</span>
              <SelectField
                value={kind}
                onChange={(e) => setKind(e.target.value as GenerateKind)}
                disabled={busy}
                data-testid="catalog-generate-kind"
                aria-label={t('brand.catalog.generateKind')}
              >
                <option value="image">{t('brand.catalog.kindImage')}</option>
                <option value="video">{t('brand.catalog.kindVideo')}</option>
                <option value="short_video">{t('brand.catalog.kindShortVideo')}</option>
              </SelectField>
            </label>
            <Button
              type="primary"
              disabled={busy || !hasSourceMedia}
              title={hasSourceMedia ? undefined : t('brand.catalog.generateNeedsMedia')}
              onClick={() => void generate()}
            >
              {t('brand.catalog.generate')}
            </Button>
          </>
        ) : (
          <p className="oma-muted oma-catalog-product-media__hint" role="status">
            {t('brand.catalog.generateAfterProfile')}
          </p>
        )}
        {trailing}
      </div>
      {message ? (
        <p className="oma-catalog-product-media__message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="oma-catalog-product-media__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
