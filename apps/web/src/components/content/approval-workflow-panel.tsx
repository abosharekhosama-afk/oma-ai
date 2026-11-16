'use client';

import { useEffect, useState } from 'react';
import { Button, Input } from 'antd';
import {
  APPROVAL_RESET_EVENT,
  confirmAiReview,
  contentApiError,
  getApprovalProgress,
  getContentPreferences,
  reopenContent,
  type ApiApprovalProgress,
  type ApiContent,
  type ContentRowExtra,
} from '../../lib/content-api';
import { useLocale, useT } from '../../lib/use-locale';
import { useToast } from '../ui/toast';

type CheckState = 'ok' | 'blocked';

const ACCOUNT_BLOCKERS = new Set([
  'NO_CONNECTED_ACCOUNT',
  'ACCOUNT_NOT_CONNECTED',
  'CHANNEL_NOT_CONNECTED',
]);

/**
 * Planable-style approval workflow block for the post editor (Phase 2):
 * lock banner + reopen (DEC-025), schedule checklist (DEC-023), AI review
 * confirmation (DEC-024) and the multi-level approval stepper (DEC-026).
 */
export function ApprovalWorkflowPanel({
  row,
  onUpdated,
}: {
  row: ContentRowExtra;
  onUpdated: (apiRow: ApiContent) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale.startsWith('ar');
  const toast = useToast();
  const [locked, setLocked] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ApiApprovalProgress | null>(null);

  const approved = row.approvalState === 'APPROVED';

  useEffect(() => {
    const onReset = (e: Event) => {
      const d = (e as CustomEvent<{ contentId: string; from: string; unscheduled: boolean }>)
        .detail;
      if (!d || d.contentId !== row.id) return;
      const key =
        d.from === 'APPROVED'
          ? d.unscheduled
            ? 'approvalFlow.reset_unscheduled'
            : 'approvalFlow.reset_approved'
          : 'approvalFlow.reset_partial';
      toast.push(t(key), 'default');
    };
    window.addEventListener(APPROVAL_RESET_EVENT, onReset);
    return () => window.removeEventListener(APPROVAL_RESET_EVENT, onReset);
  }, [row.id, t, toast]);
  const levelsKey = `${row.id}:${row.approvalState}:${row.approverApproved}`;

  useEffect(() => {
    if (!approved || !row.brandId) {
      setLocked(false);
      return;
    }
    let cancelled = false;
    void getContentPreferences(row.brandId)
      .then((res) => {
        if (!cancelled) setLocked(Boolean(res.data.lock_after_approval));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [approved, row.brandId]);

  useEffect(() => {
    if (!row.approvalLevels) {
      setProgress(null);
      return;
    }
    let cancelled = false;
    void getApprovalProgress(row.id)
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // levelsKey changes whenever a decision moves the round.
  }, [levelsKey, row.id, row.approvalLevels]);

  async function run(action: () => Promise<ApiContent>, okKey: string) {
    setBusy(true);
    try {
      const apiRow = await action();
      onUpdated(apiRow);
      toast.push(t(okKey), 'success');
      return true;
    } catch (err) {
      toast.push(contentApiError(err, t('demo.unavailable')), 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const blockers = row.scheduleReadiness?.blockers ?? [];
  const codes = new Set(blockers.map((b) => b.code));
  const checks: Array<{ key: string; label: string; state: CheckState; hint?: string }> = [
    {
      key: 'approval',
      label: t('approvalFlow.check.approval'),
      state: codes.has('APPROVAL_REQUIRED') || codes.has('REJECTED') ? 'blocked' : 'ok',
      hint: codes.has('REJECTED')
        ? t('approvalFlow.check.rejected')
        : codes.has('APPROVAL_REQUIRED')
          ? t('approvalFlow.check.approval_hint')
          : undefined,
    },
    {
      key: 'accounts',
      label: t('approvalFlow.check.accounts'),
      state: [...codes].some((c) => ACCOUNT_BLOCKERS.has(c)) ? 'blocked' : 'ok',
      hint: codes.has('NO_CONNECTED_ACCOUNT')
        ? t('approvalFlow.check.no_account')
        : codes.has('ACCOUNT_NOT_CONNECTED')
          ? t('approvalFlow.check.account_disconnected')
          : codes.has('CHANNEL_NOT_CONNECTED')
            ? t('approvalFlow.check.channel_not_connected')
            : undefined,
    },
  ];
  if (row.ai?.assisted) {
    checks.push({
      key: 'ai',
      label: t('approvalFlow.check.ai'),
      state: codes.has('AI_REVIEW_REQUIRED') || row.ai.review_required ? 'blocked' : 'ok',
      hint: row.ai.review_required ? t('approvalFlow.check.ai_hint') : undefined,
    });
  }
  const ready = row.scheduleReadiness ? row.scheduleReadiness.ready : null;

  return (
    <section className="oma-approval-flow" data-testid="approval-workflow-panel">
      {approved ? (
        <div
          className="oma-approval-flow__banner"
          data-tone={locked ? 'locked' : 'info'}
          role="status"
          data-testid="approval-lock-banner"
        >
          <span>{locked ? t('approvalFlow.locked') : t('approvalFlow.approved_resets')}</span>
          {!reopenOpen ? (
            <Button
              size="small"
              onClick={() => setReopenOpen(true)}
              data-testid="approval-reopen-open"
            >
              {t('approvalFlow.reopen')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {approved && reopenOpen ? (
        <div className="oma-approval-flow__reopen" data-testid="approval-reopen-form">
          <Input.TextArea
            rows={2}
            maxLength={1000}
            value={reason}
            placeholder={t('approvalFlow.reopen_reason')}
            aria-label={t('approvalFlow.reopen_reason')}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="oma-approval-flow__row">
            <Button
              type="primary"
              size="small"
              loading={busy}
              disabled={!reason.trim()}
              data-testid="approval-reopen-confirm"
              onClick={() =>
                void run(() => reopenContent(row.id, reason.trim()), 'approvalFlow.reopened').then(
                  (ok) => {
                    if (ok) {
                      setReopenOpen(false);
                      setReason('');
                    }
                  },
                )
              }
            >
              {t('approvalFlow.reopen_confirm')}
            </Button>
            <Button size="small" onClick={() => setReopenOpen(false)}>
              {t('approvalFlow.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {progress && progress.mode === 'levels' ? (
        <ol className="oma-approval-flow__steps" data-testid="approval-stepper">
          {progress.levels.map((level) => (
            <li
              key={level.position}
              className="oma-approval-flow__step"
              data-status={level.status}
              data-testid={`approval-step-${level.position}`}
            >
              <span className="oma-approval-flow__step-index" aria-hidden="true">
                {level.status === 'done' ? '✓' : level.position}
              </span>
              <div className="oma-approval-flow__step-body">
                <strong>{isAr ? level.name.ar || level.name.en : level.name.en}</strong>
                <span className="oma-muted">
                  {t(`approvalFlow.step.${level.status}`)} · {level.approvals}/{level.min_approvals}
                </span>
                <span className="oma-muted">
                  {level.approvers.length
                    ? level.approvers.map((a) => a.name || a.email || a.id).join(', ')
                    : t('approvalFlow.anyone_with_approve')}
                </span>
                {level.decisions.map((d) => (
                  <span
                    key={`${d.user_id}-${d.at}`}
                    className="oma-approval-flow__decision"
                    data-decision={d.decision}
                  >
                    {(d.user_name || d.user_id) + ' · ' + t(`approvalFlow.decision.${d.decision}`)}
                    {d.note ? ` — ${isAr ? d.note.ar || d.note.en : d.note.en}` : ''}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {row.scheduleReadiness ? (
        <div className="oma-approval-flow__checklist" data-testid="schedule-checklist">
          <strong data-ready={ready ? 'true' : 'false'}>
            {ready ? t('approvalFlow.ready') : t('approvalFlow.checklist')}
          </strong>
          <ul>
            {checks.map((c) => (
              <li key={c.key} data-state={c.state} data-testid={`schedule-check-${c.key}`}>
                <span aria-hidden="true">{c.state === 'ok' ? '✓' : '!'}</span>
                <span>
                  {c.label}
                  {c.hint ? <span className="oma-muted"> — {c.hint}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {row.ai?.review_required ? (
            <Button
              size="small"
              loading={busy}
              data-testid="ai-review-confirm"
              onClick={() => void run(() => confirmAiReview(row.id), 'approvalFlow.ai_reviewed')}
            >
              {t('approvalFlow.ai_review')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
