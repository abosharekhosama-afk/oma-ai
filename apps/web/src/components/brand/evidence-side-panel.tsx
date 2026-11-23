'use client';
import { Button, Modal } from '@oma/ui/controls';

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
  /** Centered dialog for profile reading; drawer remains default elsewhere. */
  presentation?: 'drawer' | 'modal';
};

function EvidencePanelBody({
  loading,
  error,
  evidence,
  prevId,
  nextId,
  onNavigate,
  onClose,
  t,
  showFootClose = false,
}: {
  loading: boolean;
  error: string | null;
  evidence: EvidenceItem | null;
  prevId: string | null;
  nextId: string | null;
  onNavigate?: (id: string) => void;
  onClose: () => void;
  t: (key: string) => string;
  showFootClose?: boolean;
}) {
  return (
    <>
      {loading ? <p className="oma-muted">{t('common.loading')}</p> : null}
      {error ? (
        <p role="alert" style={{ color: 'var(--status-danger)' }}>
          {error}
        </p>
      ) : null}
      {evidence ? <EvidenceClarity evidence={evidence} /> : null}
      {(prevId || nextId || showFootClose) && (
        <div className="oma-evidence-panel__foot">
          {(prevId || nextId) && onNavigate ? (
            <div className="oma-header-actions">
              <Button type="default" disabled={!prevId} onClick={() => prevId && onNavigate(prevId)}>
                {t('brand.evidence.prev')}
              </Button>
              <Button type="default" disabled={!nextId} onClick={() => nextId && onNavigate(nextId)}>
                {t('brand.evidence.next')}
              </Button>
            </div>
          ) : null}
          {showFootClose ? (
            <Button type="default" onClick={onClose}>
              {t('brand.evidence.close')}
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}

export function EvidenceSidePanel({
  brandId,
  evidenceId,
  evidenceIds = [],
  onClose,
  onNavigate,
  presentation = 'drawer',
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

  useEffect(() => {
    if (!evidenceId || !onNavigate) return;
    const navigate = onNavigate;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft' && prevId) navigate(prevId);
      if (event.key === 'ArrowRight' && nextId) navigate(nextId);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [evidenceId, nextId, onNavigate, prevId]);

  const isModal = presentation === 'modal';
  const body = (
    <EvidencePanelBody
      loading={loading}
      error={error}
      evidence={evidence}
      prevId={prevId}
      nextId={nextId}
      onNavigate={onNavigate}
      onClose={onClose}
      t={t}
      showFootClose={isModal}
    />
  );

  if (presentation === 'modal') {
    return (
      <Modal
        open={Boolean(evidenceId)}
        onCancel={onClose}
        title={t('brand.evidence.title')}
        footer={null}
        width={720}
        destroyOnHidden
        className="oma-evidence-modal"
      >
        {body}
      </Modal>
    );
  }

  return (
    <Drawer open={Boolean(evidenceId)} onClose={onClose} label={t('brand.evidence.title')} wide>
      <header className="oma-drawer-header">
        <h2 id="evidence-panel-title">{t('brand.evidence.title')}</h2>
        <Button type="default" onClick={onClose}>
          {t('brand.evidence.close')}
        </Button>
      </header>
      {body}
    </Drawer>
  );
}