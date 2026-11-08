'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_APPROVALS,
  getBrandApprovalSettings,
  saveBrandApprovalSettings,
  type ApprovalSettings,
} from '../../lib/workspace-extras-api';
import { WorkspaceApprovals } from '../shell/workspace-approvals';
import { useT } from '../../lib/use-locale';

/** Brand-level approval & publish gates. Workspace settings are the default until this brand overrides them. */
export function BrandApprovalsSettings({
  canManage,
  brandId,
}: {
  canManage: boolean;
  brandId: string;
}) {
  const t = useT();
  const [approvals, setApprovals] = useState<ApprovalSettings>(DEFAULT_APPROVALS);
  const [source, setSource] = useState<'brand' | 'workspace'>('workspace');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState('loading');
    void getBrandApprovalSettings(brandId)
      .then((next) => {
        setApprovals({
          mode: next.mode,
          requiredApprovers: next.requiredApprovers,
          scheduleOnApproval: next.scheduleOnApproval,
          lockAfterApproval: next.lockAfterApproval,
          reminderPendingApprovals: next.reminderPendingApprovals,
        });
        setSource(next.source);
        setState('ready');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      });
  }, [brandId]);

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
          {source === 'workspace' ? ` · ${t('brandSettings.approvals.usingWorkspace')}` : ''}
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
          saveSettings={async (next) => {
            const saved = await saveBrandApprovalSettings(brandId, next);
            setSource('brand');
            return saved;
          }}
        />
      ) : null}
    </section>
  );
}
