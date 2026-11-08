'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getSubscription } from '../../lib/billing-api';
import { useT } from '../../lib/use-locale';
import {
  listWorkspaceMembers,
  permissionsToCapabilityCodes,
  updateMemberCapabilities,
  type WorkspaceMember,
} from '../../lib/team-api';
import { saveApprovalSettings, type ApprovalSettings } from '../../lib/workspace-extras-api';
import {
  CheckOutlined,
  ClockCircleOutlined,
  LockOutlined,
  NotificationOutlined,
} from '../ui/lucide-icons';

type Mode = ApprovalSettings['mode'];

const MODES: Array<{
  id: Mode;
  title: string;
  desc: string;
  badge?: 'PRO' | 'ENT';
  marks: 0 | 1 | 3;
}> = [
  {
    id: 'none',
    title: 'wsPanel.approvals.none_title',
    desc: 'wsPanel.approvals.none_desc',
    marks: 0,
  },
  {
    id: 'optional',
    title: 'wsPanel.approvals.optional_title',
    desc: 'wsPanel.approvals.optional_desc',
    marks: 1,
  },
  {
    id: 'required',
    title: 'wsPanel.approvals.required_title',
    desc: 'wsPanel.approvals.required_desc',
    badge: 'PRO',
    marks: 1,
  },
  {
    id: 'multi_level',
    title: 'wsPanel.approvals.multi_title',
    desc: 'wsPanel.approvals.multi_desc',
    badge: 'ENT',
    marks: 3,
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function Switch({
  on,
  disabled,
  label,
  testId,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  testId?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      className={`oma-ws-switch${on ? ' is-on' : ''}`}
      onClick={onClick}
    >
      <span className="oma-ws-switch-knob" />
    </button>
  );
}

export function WorkspaceApprovals({
  approvals,
  onChange,
  onError,
  saveSettings,
}: {
  approvals: ApprovalSettings;
  onChange: (next: ApprovalSettings) => void;
  onError: (msg: string) => void;
  saveSettings?: (next: ApprovalSettings) => Promise<ApprovalSettings>;
}) {
  const t = useT();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [planCode, setPlanCode] = useState('free');
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listWorkspaceMembers()
      .then(setMembers)
      .catch(() => setMembers([]));
    void api<{ user?: { id?: string } }>('/api/v1/auth/me')
      .then((data) => {
        if (data?.user?.id) setMeId(data.user.id);
      })
      .catch(() => undefined);
    void getSubscription()
      .then((res) => {
        setPlanCode(res.data.plan_code);
        setFeatures(res.data.plan?.features ?? {});
      })
      .catch(() => undefined);
  }, []);

  const persist = useCallback(
    async (next: ApprovalSettings) => {
      onChange(next);
      setBusy(true);
      try {
        const saved = await (saveSettings ?? saveApprovalSettings)(next);
        onChange(saved);
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onChange, onError, saveSettings],
  );

  const canRequired =
    features.approvals_required === true ||
    planCode === 'pro' ||
    planCode === 'agency' ||
    planCode === 'enterprise';
  const canMulti =
    features.approvals_multi_level === true || planCode === 'agency' || planCode === 'enterprise';

  const visibleMembers = showAll ? members : members.slice(0, 3);

  return (
    <div className="oma-ws-appr" data-busy={busy ? 'true' : 'false'}>
      <div className="oma-ws-appr-grid" data-testid="ws-approval-mode">
        {MODES.map((mode) => {
          const selected = approvals.mode === mode.id;
          const locked =
            (mode.id === 'required' && !canRequired) || (mode.id === 'multi_level' && !canMulti);
          return (
            <button
              key={mode.id}
              type="button"
              className={`oma-ws-appr-card${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`}
              data-testid={`ws-approval-mode-${mode.id}`}
              aria-pressed={selected}
              onClick={() => {
                if (locked) {
                  onError(t('wsPanel.approvals.upgrade_required'));
                  return;
                }
                const requiredApprovers =
                  mode.id === 'multi_level'
                    ? Math.max(2, approvals.requiredApprovers || 2)
                    : mode.id === 'required'
                      ? 1
                      : 1;
                void persist({ ...approvals, mode: mode.id, requiredApprovers });
              }}
            >
              {selected ? (
                <span className="oma-ws-appr-card-check" aria-hidden="true">
                  <CheckOutlined />
                </span>
              ) : null}
              <span className="oma-ws-appr-card-head">
                <span
                  className={`oma-ws-appr-radio marks-${mode.marks}${selected ? ' is-on' : ''}`}
                >
                  {mode.marks === 0 ? null : mode.marks === 3 ? (
                    <>
                      <CheckOutlined />
                      <CheckOutlined />
                      <CheckOutlined />
                    </>
                  ) : (
                    <CheckOutlined />
                  )}
                </span>
                <span className="oma-ws-appr-card-title">{t(mode.title)}</span>
                {mode.badge ? (
                  <span
                    className={`oma-ws-appr-badge oma-ws-appr-badge--${mode.badge.toLowerCase()}`}
                  >
                    {mode.badge}
                  </span>
                ) : null}
              </span>
              <span className="oma-ws-appr-card-desc">{t(mode.desc)}</span>
            </button>
          );
        })}
      </div>
      {approvals.mode === 'required' || approvals.mode === 'multi_level' ? (
        <div className="oma-ws-field" style={{ marginTop: 16 }}>
          <label className="oma-ws-label" htmlFor="ws-required-approvers">
            {t('wsPanel.approvers_required')}
          </label>
          <select
            id="ws-required-approvers"
            className="oma-ws-appr-select"
            data-testid="ws-required-approvers"
            value={String(approvals.requiredApprovers)}
            onChange={(e) => {
              const n = Number(e.target.value);
              void persist({
                ...approvals,
                mode: n >= 2 ? 'multi_level' : 'required',
                requiredApprovers: n,
              });
            }}
          >
            {(approvals.mode === 'multi_level' ? [2, 3, 4, 5] : [1, 2, 3, 4, 5]).map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <h3 className="oma-ws-appr-sub">{t('wsPanel.approvals.who_can_approve')}</h3>
      <ul className="oma-ws-appr-members">
        {visibleMembers.map((m) => {
          const name = m.user?.name || m.invited_email || m.user?.email || t('team.you');
          const canApprove = Boolean(m.permissions?.approve);
          const isMe = Boolean(meId && m.user?.id === meId);
          const kind = m.membership === 'client' ? 'client' : 'team';
          return (
            <li key={m.id} className="oma-ws-appr-member">
              <span className="oma-ws-appr-avatar" aria-hidden="true">
                {initials(name)}
              </span>
              <span className="oma-ws-appr-member-meta">
                <span className="oma-ws-appr-member-name">
                  {name}
                  {isMe ? <span className="oma-ws-appr-you">({t('team.you')})</span> : null}
                  <span className={`oma-ws-appr-kind oma-ws-appr-kind--${kind}`}>
                    {kind === 'client'
                      ? t('wsPanel.approvals.client')
                      : t('wsPanel.approvals.team')}
                  </span>
                </span>
                <span className="oma-ws-appr-member-sub">
                  {isMe
                    ? t('wsPanel.approvals.online')
                    : (m.user?.email ?? m.invited_email ?? m.last_online ?? '')}
                </span>
              </span>
              <Switch
                on={canApprove}
                label={t('wsPanel.approvals.who_can_approve')}
                testId={`ws-approver-toggle-${m.id}`}
                onClick={() => {
                  const nextPerms = {
                    ...(m.permissions ?? {
                      view: true,
                      approve: false,
                      edit: false,
                      publish: false,
                      analyze: false,
                      engage: false,
                      admin: false,
                    }),
                    approve: !canApprove,
                  };
                  void updateMemberCapabilities(m.id, permissionsToCapabilityCodes(nextPerms))
                    .then(() => listWorkspaceMembers({ force: true }).then(setMembers))
                    .catch((err: unknown) =>
                      onError(err instanceof Error ? err.message : String(err)),
                    );
                }}
              />
            </li>
          );
        })}
      </ul>
      {members.length > 3 ? (
        <button
          type="button"
          className="oma-ws-appr-more"
          data-testid="ws-approvals-show-all"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll
            ? t('wsPanel.approvals.show_fewer')
            : t('wsPanel.approvals.show_all_collaborators')}
        </button>
      ) : null}

      <h3 className="oma-ws-appr-sub">{t('wsPanel.approvals.settings')}</h3>
      <div className="oma-ws-toggles oma-ws-appr-toggles">
        <div className="oma-ws-toggle-row">
          <span className="oma-ws-appr-toggle-label">
            <ClockCircleOutlined />
            {t('wsPanel.approvals.schedule_on_approval')}
          </span>
          <Switch
            on={approvals.scheduleOnApproval}
            label={t('wsPanel.approvals.schedule_on_approval')}
            testId="ws-schedule-on-approval"
            onClick={() =>
              void persist({ ...approvals, scheduleOnApproval: !approvals.scheduleOnApproval })
            }
          />
        </div>
        <div className="oma-ws-toggle-row">
          <span className="oma-ws-appr-toggle-label">
            <LockOutlined />
            {t('wsPanel.approvals.lock_after_approval')}
          </span>
          <Switch
            on={approvals.lockAfterApproval}
            label={t('wsPanel.approvals.lock_after_approval')}
            testId="ws-lock-after-approval"
            onClick={() =>
              void persist({ ...approvals, lockAfterApproval: !approvals.lockAfterApproval })
            }
          />
        </div>
        <div className="oma-ws-toggle-row">
          <span className="oma-ws-appr-toggle-label">
            <NotificationOutlined />
            {t('wsPanel.approvals.reminders')}
          </span>
          <Switch
            on={approvals.reminderPendingApprovals}
            label={t('wsPanel.approvals.reminders')}
            testId="ws-reminder-pending"
            onClick={() =>
              void persist({
                ...approvals,
                reminderPendingApprovals: !approvals.reminderPendingApprovals,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
