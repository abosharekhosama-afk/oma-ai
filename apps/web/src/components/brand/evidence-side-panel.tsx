'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { EvidenceItem } from '../../lib/brand-types';
import { getApiError } from '../../lib/brand-api';
import { useT } from '../../lib/use-locale';
import { EvidenceClarity } from './evidence-clarity';

type EvidenceSidePanelProps = {
  brandId: string;
  evidenceId: string | null;
  onClose: () => void;
};

export function EvidenceSidePanel({ brandId, evidenceId, onClose }: EvidenceSidePanelProps) {
  const t = useT();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!evidenceId) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [evidenceId, onClose]);

  if (!evidenceId) return null;

  return (
    <>
      <button
        type="button"
        className="oma-drawer-backdrop"
        aria-label={t('brand.evidence.close')}
        onClick={onClose}
      />
      <section
        ref={panelRef}
        className="oma-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-panel-title"
      >
        <header className="oma-drawer-header">
          <h2 id="evidence-panel-title">{t('brand.evidence.title')}</h2>
          <button ref={closeRef} type="button" className="oma-btn-secondary" onClick={onClose}>
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
      </section>
    </>
  );
}
