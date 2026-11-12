'use client';

import { Button } from '@oma/ui/controls';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import type { InsightItem } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';
import { useState } from 'react';

export function CatalogInsightsBulkBar({
  brandId,
  versionId,
  insights,
  editable,
  onAccepted,
}: {
  brandId: string;
  versionId: string;
  insights: InsightItem[];
  editable: boolean;
  onAccepted: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = insights.filter(
    (i) => i.field_key.startsWith('catalog.') && i.review_status === 'PENDING',
  );
  if (!editable || pending.length === 0) return null;

  async function acceptAll() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/brands/${brandId}/profiles/${versionId}/insights/bulk-accept`, {
        method: 'POST',
        body: JSON.stringify({
          insights: pending.map((i) => ({ id: i.id, row_version: i.row_version })),
        }),
      });
      onAccepted();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oma-panel oma-form-actions" data-testid="catalog-insights-bulk-accept">
      <p className="oma-muted">{t('brand.discovery.catalogBulkAcceptHint')}</p>
      <Button type="primary" disabled={busy} onClick={() => void acceptAll()}>
        {t('brand.discovery.catalogBulkAccept')}
      </Button>
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
