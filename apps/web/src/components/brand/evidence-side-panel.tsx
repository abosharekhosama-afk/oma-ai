'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { EvidenceItem } from '../../lib/brand-types';
import { getApiError } from '../../lib/brand-api';
import { useT } from '../../lib/use-locale';
import { Drawer } from '../ui/drawer';
import { EvidenceClarity } from './evidence-clarity';

type EvidenceSidePanelProps = {
  brandId: string;
  evidenceId: string | null;
  evidenceIds?: string[];
  onClose: () => void;
  onNavigate?: (id: string) => void;
};

export function EvidenceSidePanel({
  brandId,
  evidenceId,
  evidenceIds = [],
  onClose,
  onNavigate,
}: EvidenceSidePanelProps) {
  const t = useT();
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!evidenceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: EvidenceItem }>(
        `/api/v1/brands/${brandId}/evidence/${evidenceId}`,
      );
      setEvidence(res.data);
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [brandId, evidenceId]);

  useEffect(() => {
    if (evidenceId) void load();
    else setEvidence(null);
  }, [evidenceId, load]);

  const index = evidenceId ? evidenceIds.indexOf(evidenceId) : -1;
  const prevId = index > 0 ? evidenceIds[index - 1] : null;
  const nextId = index >= 0 && index < evidenceIds.length - 1 ? evidenceIds[index + 1] : null;

  return (
    <Drawer open={Boolean(evidenceId)} onClose={onClose} label={t('brand.evidence.title')}>
      <header className="oma-drawer-header">
        <h2 id="evidence-panel-title">{t('brand.evidence.title')}</h2>
        <button type="button" className="oma-btn oma-btn-secondary oma-btn--sm" onClick={onClose}>
          {t('brand.evidence.close')}
        </button>
      </header>
      {loading ? <p className="oma-muted">{t('common.loading')}</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
      {evidence ? <EvidenceClarity evidence={evidence} /> : null}
      {(prevId || nextId) && onNavigate ? (
        <div className="oma-header-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="oma-btn oma-btn-secondary oma-btn--sm"
            disabled={!prevId}
            onClick={() => prevId && onNavigate(prevId)}
          >
            {t('brand.evidence.prev')}
          </button>
          <button
            type="button"
            className="oma-btn oma-btn-secondary oma-btn--sm"
            disabled={!nextId}
            onClick={() => nextId && onNavigate(nextId)}
          >
            {t('brand.evidence.next')}
          </button>
        </div>
      ) : null}
    </Drawer>
  );
}
