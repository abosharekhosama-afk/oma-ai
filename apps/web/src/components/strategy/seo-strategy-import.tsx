'use client';

import { Button, Tag } from '@oma/ui/controls';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import type { StrategyPlan } from '../../lib/strategy-plan-api';
import { useT } from '../../lib/use-locale';

type SeoProposalPackage = {
  context: {
    scan_attempt_id: string | null;
    audit_score: number | null;
    audit_created_at: string | null;
    gsc_source: string | null;
    gsc_last_sync_at: string | null;
    findings_count: number;
    queries_count: number;
  };
  seo_keywords: Array<{ proposal_id: string; keyword: string; locale: string; intent: string }>;
  content_gaps: Array<{ proposal_id: string; kind: string; topic: string; finding_code?: string }>;
};

export function SeoStrategyImport({
  brandId,
  strategyId,
  versionId,
  editable,
  plan,
  onMerged,
}: {
  brandId: string;
  strategyId: string;
  versionId: string;
  editable: boolean;
  plan: StrategyPlan | null;
  onMerged: (next: StrategyPlan) => void;
}) {
  const t = useT();
  const [pkg, setPkg] = useState<SeoProposalPackage | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: SeoProposalPackage }>(
        `/api/v1/brands/${brandId}/seo/strategy-proposals`,
      );
      setPkg(res.data);
      const ids = [
        ...res.data.seo_keywords.map((k) => k.proposal_id),
        ...res.data.content_gaps.map((g) => g.proposal_id),
      ];
      setSelected(new Set(ids));
      if (ids.length === 0) {
        setStatus({ kind: 'info', text: t('strategy.plan.seoImport.empty') });
      } else {
        setStatus(null);
      }
    } catch (err) {
      setStatus({ kind: 'error', text: getApiError(err).message });
    }
  }, [brandId, t]);

  useEffect(() => {
    if (editable) void load();
  }, [editable, load]);

  const totalCount = useMemo(() => {
    if (!pkg) return 0;
    return pkg.seo_keywords.length + pkg.content_gaps.length;
  }, [pkg]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyMerge() {
    if (!plan || selected.size === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await api<{ data: StrategyPlan }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan/organic/merge-seo`,
        {
          method: 'POST',
          body: JSON.stringify({
            row_version: plan.row_version,
            proposal_ids: [...selected],
          }),
        },
      );
      onMerged(res.data);
      setStatus({ kind: 'info', text: t('strategy.plan.seoImport.applied') });
      void load();
    } catch (err) {
      setStatus({ kind: 'error', text: getApiError(err).message });
    } finally {
      setBusy(false);
    }
  }

  if (!editable || !pkg) return null;

  return (
    <section className="oma-panel oma-seo-import" data-testid="seo-strategy-import">
      <header className="oma-plan-toolbar">
        <h3 style={{ margin: 0 }}>{t('strategy.plan.seoImport.title')}</h3>
        <Tag data-testid="seo-import-score">
          {pkg.context.audit_score != null
            ? `${t('strategy.plan.seoImport.score')}: ${pkg.context.audit_score}`
            : t('strategy.plan.seoImport.noAudit')}
        </Tag>
        {pkg.context.scan_attempt_id ? (
          <Tag color="blue">{t('strategy.plan.seoImport.scanBadge')}</Tag>
        ) : null}
        {pkg.context.queries_count > 0 ? (
          <Tag color="green">
            {t('strategy.plan.seoImport.gscBadge')}: {pkg.context.queries_count}
          </Tag>
        ) : null}
      </header>
      <p className="oma-help">{t('strategy.plan.seoImport.lead')}</p>
      {totalCount === 0 ? (
        <p>{t('strategy.plan.seoImport.hint')}</p>
      ) : (
        <>
          <div className="oma-seo-import-grid">
            <div>
              <h4>{t('strategy.plan.keywords')}</h4>
              <ul className="oma-check-list">
                {pkg.seo_keywords.map((k) => (
                  <li key={k.proposal_id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(k.proposal_id)}
                        onChange={() => toggle(k.proposal_id)}
                      />
                      {k.keyword}{' '}
                      <span className="oma-muted">
                        ({k.locale} · {t(`strategy.plan.intent.${k.intent}`)})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>{t('strategy.plan.gaps')}</h4>
              <ul className="oma-check-list">
                {pkg.content_gaps.map((g) => (
                  <li key={g.proposal_id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(g.proposal_id)}
                        onChange={() => toggle(g.proposal_id)}
                      />
                      {g.topic}{' '}
                      <span className="oma-muted">({t(`strategy.plan.gapKind.${g.kind}`)})</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Button
            type="primary"
            disabled={busy || selected.size === 0}
            onClick={() => void applyMerge()}
            data-testid="seo-import-apply"
          >
            {t('strategy.plan.seoImport.apply')}
          </Button>
        </>
      )}
      {status ? (
        <p role={status.kind === 'error' ? 'alert' : 'status'} data-state={status.kind}>
          {status.text}
        </p>
      ) : null}
    </section>
  );
}
