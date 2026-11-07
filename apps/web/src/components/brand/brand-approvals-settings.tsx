'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_APPROVALS,
  approvalsFromSettings,
  getWorkspaceSettings,
  type ApprovalSettings,
} from '../../lib/workspace-extras-api';
import { WorkspaceApprovals } from '../shell/workspace-approvals';
import { useT } from '../../lib/use-locale';

/** Workspace-level approval & publish gates (same rules apply to every brand). */
export function BrandApprovalsSettings({ canManage }: { canManage: boolean }) {
  const t = useT();
  const [approvals, setApprovals] = useState<ApprovalSettings>(DEFAULT_APPROVALS);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getWorkspaceSettings()
      .then((ws) => {
        setApprovals(approvalsFromSettings(ws));
        setState('ready');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      });
  }, []);

  return (
    <section className="oma-bs-section" data-testid="brand-settings-approvals">
      <h2 className="oma-bs-section-title">{t('brandSettings.approvals.title')}</h2>
      <p className="oma-bs-muted">{t('brandSettings.approvals.workspaceNote')}</p>
      {!canManage ? (
        <p className="oma-bs-muted" role="status">
          {t('brandSettings.approvals.readOnly')}
        </p>
      ) : null}
      {state === 'ready' && !canManage ? (
        <p className="oma-bs-muted">
          {t(
            (
              {
                none: 'wsPanel.approvals.none_title',
                optional: 'wsPanel.approvals.optional_title',
                required: 'wsPanel.approvals.required_title',
                multi_level: 'wsPanel.approvals.multi_title',
              } as const
            )[approvals.mode],
          )}
          {approvals.scheduleOnApproval ? ` · ${t('wsPanel.approvals.schedule_on_approval')}` : ''}
        </p>
      ) : null}
      {state === 'loading' ? (
        <div className="oma-skeleton" style={{ height: 160 }} aria-busy="true" />
      ) : null}
      {state === 'error' ? (
        <p className="oma-bs-notice oma-bs-notice--error" role="alert">
          {error}
        </p>
      ) : null}
      {state === 'ready' && canManage ? (
        <WorkspaceApprovals
          approvals={approvals}
          onChange={setApprovals}
          onError={(msg) => setError(msg)}
        />
      ) : null}
    </section>
  );
}
