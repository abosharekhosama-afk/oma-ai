'use client';
import { TableShimmer } from '../../../../components/ui/shimmer';

import { Button, Input, SelectField } from '@oma/ui/controls';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  attachMemberProfile,
  inviteMember,
  listWorkspaceMembers,
  permissionsToCapabilityCodes,
  removeMember,
  isOwnerMember,
  readablePermissions,
  updateMemberCapabilities,
  type MembershipType,
  type PlanablePerm,
  type WorkspaceMember,
  PERMISSION_LABELS,
  capabilitiesToPermissions,
} from '../../../../lib/team-api';
import { Popover } from 'antd';
import { openSettings } from '../../../../lib/settings-dialog';
import { TEAM_INVITE_EVENT } from '../../../../lib/team-invite';
import { useToast } from '../../../../components/ui/toast';
import { api } from '../../../../lib/api';
import { statusLabel } from '../../../../components/ui/status-chip';
import { useLocale, useT } from '../../../../lib/use-locale';

type Tab = 'members' | 'permissions' | 'notifications';

const PERM_COLS: PlanablePerm[] = [
  'view',
  'approve',
  'edit',
  'publish',
  'analyze',
  'engage',
  'admin',
];

const ROLE_OPTIONS = ['Owner', 'Administrator', 'Contributor', 'Writer', 'Approver', 'Guest'];

/** What each role can do by default (same mapping used when an invite is sent). */
function rolePermissions(role: string): Record<PlanablePerm, boolean> {
  return {
    view: true,
    approve: role === 'Approver' || role === 'Administrator' || role === 'Owner',
    edit: !['Guest', 'Approver'].includes(role),
    publish: ['Contributor', 'Administrator', 'Owner'].includes(role),
    analyze: ['Administrator', 'Owner'].includes(role),
    engage: true,
    admin: ['Administrator', 'Owner'].includes(role),
  };
}

/** Popover card explaining what a member can do (opened from the permissions link). */
function PermissionsCard({
  member,
  isSelf,
  isAr,
  t,
}: {
  member: WorkspaceMember;
  isSelf: boolean;
  isAr: boolean;
  t: (k: string) => string;
}) {
  const perms = member.permissions ?? capabilitiesToPermissions(member.capabilities || []);
  const role = member.role || 'Contributor';
  return (
    <div className="oma-perm-card" dir={isAr ? 'rtl' : 'ltr'} data-testid="team-permissions-card">
      <div className="oma-perm-card__head">
        <span className="oma-perm-card__role">{t(`members.role.${role.toLowerCase()}`)}</span>
        <span className="oma-perm-card__kind">
          {member.membership === 'client' ? t('team.client') : t('team.team')}
        </span>
      </div>
      <p className="oma-perm-card__desc">{t(`team.roleDesc.${role.toLowerCase()}`)}</p>
      <ul className="oma-perm-card__list">
        {PERM_COLS.map((p) => (
          <li key={p} className={perms[p] ? 'is-on' : 'is-off'}>
            <span className="oma-perm-card__mark" aria-hidden="true">
              {perms[p] ? '✓' : '–'}
            </span>
            <span>{isAr ? PERMISSION_LABELS[p].ar : PERMISSION_LABELS[p].en}</span>
            <span className="oma-sr-only">
              {perms[p] ? t('team.perm.allowed') : t('team.perm.notAllowed')}
            </span>
          </li>
        ))}
      </ul>
      <p className="oma-perm-card__foot">
        {isSelf ? t('team.perm.footSelf') : t('team.perm.footOther')}
      </p>
    </div>
  );
}

export default function TeamPage() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('members');
  const [rows, setRows] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const source = 'api' as const;
  const isAr = useLocale().toLowerCase().startsWith('ar');
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    api<{ user: { id: string } }>('/api/v1/auth/me')
      .then((me) => setMeId(me.user.id))
      .catch(() => setMeId(null));
  }, []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Contributor');
  const [inviteMembership, setInviteMembership] = useState<MembershipType>('team');
  const [busy, setBusy] = useState(false);
  // The "Invite members" button lives in the shell header (replaces the generic Create button).
  useEffect(() => {
    const open = () => setInviteOpen(true);
    window.addEventListener(TEAM_INVITE_EVENT, open);
    return () => window.removeEventListener(TEAM_INVITE_EVENT, open);
  }, []);
  const [q, setQ] = useState('');
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  async function load(force = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await listWorkspaceMembers({ force });
      if (!mountedRef.current) return;
      setRows(data);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : t('team.failed_to_load_team'));
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void load(false);
    return () => {
      mountedRef.current = false;
    };
    // Mount-once — avoid re-fetch loops from unstable callbacks/locale.
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((m) => {
      const name = m.user?.name || '';
      const email = m.user?.email || m.invited_email || '';
      return (
        name.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        (m.role || '').toLowerCase().includes(query)
      );
    });
  }, [rows, q]);

  async function onInvite() {
    if (!inviteEmail.trim() || busy) return;
    setBusy(true);
    try {
      if (source === 'api') {
        await inviteMember({
          email: inviteEmail.trim(),
          role: inviteRole,
          membership: inviteMembership,
        });
        await load(true);
      } else {
        setRows((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            status: 'INVITED',
            invited_email: inviteEmail.trim(),
            user: null,
            capabilities: [],
            source_profiles: [inviteRole],
            role: inviteRole,
            membership: inviteMembership,
            permissions: rolePermissions(inviteRole),
            last_online: 'Invited',
          },
        ]);
      }
      setInviteOpen(false);
      setInviteEmail('');
      toast.push(t('team.invitation_sent'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.invite_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePerm(member: WorkspaceMember, perm: PlanablePerm) {
    if (!member.permissions) return;
    const next = { ...member.permissions, [perm]: !member.permissions[perm] };
    setRows((prev) => prev.map((r) => (r.id === member.id ? { ...r, permissions: next } : r)));
    if (source !== 'api') return;
    try {
      await updateMemberCapabilities(member.id, permissionsToCapabilityCodes(next));
      toast.push(t('team.permissions_updated'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.update_failed'), 'danger');
      await load(true);
    }
  }

  async function onRemove(member: WorkspaceMember) {
    if (
      !window.confirm(
        t('team.removeConfirm').replace('{name}', member.user?.email || member.invited_email || ''),
      )
    )
      return;
    setBusy(true);
    try {
      if (source === 'api') await removeMember(member.id);
      setRows((prev) => prev.filter((r) => r.id !== member.id));
      toast.push(t('team.member_removed'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.remove_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function onChangeRole(member: WorkspaceMember, role: string) {
    setRows((prev) => prev.map((r) => (r.id === member.id ? { ...r, role } : r)));
    if (source !== 'api') return;
    const map: Record<string, string> = {
      Owner: 'COMPANY_OWNER',
      Administrator: 'ADMIN',
      Contributor: 'MEMBER',
      Writer: 'WRITER',
      Approver: 'APPROVER',
      Guest: 'GUEST',
    };
    const code = map[role];
    if (!code) return;
    try {
      await attachMemberProfile(member.id, code);
      toast.push(t('team.role_updated'), 'success');
      void load(true);
    } catch (err) {
      // Revert: never show a role the server didn't accept.
      setRows((prev) => prev.map((r) => (r.id === member.id ? member : r)));
      toast.push(err instanceof Error ? err.message : t('errors.update_failed'), 'danger');
    }
  }

  return (
    <div className="oma-planable-page" data-testid="team-page-planable">
      <div className="oma-planable-page__header">
        <div>
          <h1 className="oma-planable-page__title">{t('wsPanel.team_clients')}</h1>
          <p className="oma-planable-page__sub">
            {t('team.invite_collaborators_set_teamclient_membership')}
          </p>
        </div>
      </div>

      <div className="oma-ws-tabs">
        {(
          [
            ['members', 'team.tab.members'],
            ['permissions', 'team.tab.permissions'],
            ['notifications', 'team.tab.notifications'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`oma-ws-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {loading ? <TableShimmer rows={5} /> : null}
      {error ? (
        <div className="plx-empty" role="alert">
          <strong>{error}</strong>
          <div style={{ marginTop: 12 }}>
            <Button type="default" onClick={() => void load(true)}>
              {t('activity.retry')}
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && !error && tab === 'members' ? (
        <>
          <div className="oma-planable-toolbar">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('team.search_members')}
            />
          </div>
          <div className="oma-planable-card oma-member-surface">
            <table className="oma-ws-table">
              <thead>
                <tr>
                  <th>{t('team.user')}</th>
                  <th>{t('team.membership')}</th>
                  <th>{t('demo.team.filter.role')}</th>
                  <th>{t('strategy.list.col.status')}</th>
                  <th>{t('team.last_online')}</th>
                  <th>{t('team.permissions')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="oma-ws-empty-block">
                        <h3>{t('company.membersEmpty')}</h3>
                        <p>{t('team.invite_teammates_or_clients_to')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const label =
                      m.user?.name || m.user?.email || m.invited_email || t('team.user');
                    const email = m.user?.email || m.invited_email || '';
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="oma-ws-user-cell">
                            <span className="oma-ws-avatar oma-ws-avatar--sm">
                              {(label[0] || 'U').toUpperCase()}
                            </span>
                            <div>
                              <div className="oma-ws-user-name">
                                {label}
                                {m.user?.id && m.user.id === meId ? (
                                  <span
                                    className="oma-ws-badge oma-ws-badge--ghost"
                                    style={{ marginInlineStart: 6 }}
                                  >
                                    {t('content.you')}
                                  </span>
                                ) : null}
                              </div>
                              {email ? <div className="oma-ws-user-email">{email}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`oma-ws-badge${
                              m.membership === 'client' ? ' oma-ws-badge--client' : ''
                            }`}
                          >
                            {m.membership === 'client' ? t('team.client') : t('team.team')}
                          </span>
                        </td>
                        <td>
                          <SelectField
                            value={m.role || 'Member'}
                            onChange={(e) => void onChangeRole(m, e.target.value)}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {t(`members.role.${r.toLowerCase()}`)}
                              </option>
                            ))}
                          </SelectField>
                        </td>
                        <td>
                          <span className="oma-ws-badge oma-ws-badge--ghost">
                            {statusLabel(t, m.status)}
                          </span>
                        </td>
                        <td>
                          {m.last_online === 'Invited'
                            ? t('team.invited')
                            : m.last_online === 'Active'
                              ? t('status.enum.ACTIVE')
                              : m.last_online || '—'}
                        </td>
                        <td className="oma-ws-perm-summary" data-testid="team-permissions">
                          <Popover
                            trigger="click"
                            arrow={false}
                            placement={isAr ? 'bottomRight' : 'bottomLeft'}
                            getPopupContainer={() => document.body}
                            classNames={{ root: 'oma-perm-popover' }}
                            content={
                              <PermissionsCard
                                member={m}
                                isSelf={Boolean(m.user?.id && m.user.id === meId)}
                                isAr={isAr}
                                t={t}
                              />
                            }
                          >
                            <button
                              type="button"
                              className="oma-perm-link"
                              aria-label={readablePermissions(m, isAr).join(t('team.text'))}
                            >
                              {m.user?.id && m.user.id === meId
                                ? t('team.perm.yours')
                                : t('team.perm.view')}
                            </button>
                          </Popover>
                        </td>
                        <td>
                          {isOwnerMember(m) || (m.user?.id && m.user.id === meId) ? (
                            <span className="oma-muted" data-testid="team-no-remove">
                              {isOwnerMember(m) ? t('demo.campaigns.col.owner') : '—'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="oma-ws-danger-btn"
                              onClick={() => void onRemove(m)}
                              disabled={busy}
                            >
                              {t('team.remove')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!loading && !error && tab === 'permissions' ? (
        <div className="oma-planable-card">
          <h3 className="oma-ws-subhead">{t('team.adjust_permissions')}</h3>
          <p className="oma-ws-empty-desc">{t('team.set_who_can_view_approve')}</p>
          <div
            className="oma-ws-table-scroll"
            role="region"
            aria-label={t('team.adjust_permissions')}
            tabIndex={0}
            data-testid="team-permissions-scroll"
          >
            <table className="oma-ws-table oma-ws-table--perms">
              <thead>
                <tr>
                  <th>{t('team.user')}</th>
                  {PERM_COLS.map((p) => (
                    <th key={p}>{isAr ? PERMISSION_LABELS[p].ar : PERMISSION_LABELS[p].en}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const label = m.user?.name || m.user?.email || m.invited_email || t('team.user');
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="oma-ws-user-cell">
                          <span className="oma-ws-avatar oma-ws-avatar--sm">
                            {(label[0] || 'U').toUpperCase()}
                          </span>
                          <div>
                            <div className="oma-ws-user-name">{label}</div>
                            <div className="oma-muted">{m.role}</div>
                          </div>
                        </div>
                      </td>
                      {PERM_COLS.map((p) => (
                        <td key={p} className="oma-ws-check-cell">
                          <input
                            type="checkbox"
                            checked={Boolean(m.permissions?.[p])}
                            onChange={() => void onTogglePerm(m, p)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && !error && tab === 'notifications' ? (
        <div className="oma-planable-card" data-testid="team-notifications">
          <h3 className="oma-ws-subhead">{t('team.manage_notifications')}</h3>
          <p className="oma-ws-empty-desc">{t('team.notifications.personal')}</p>
          <Button type="primary" onClick={() => openSettings('notifications')}>
            {t('team.notifications.open')}
          </Button>
        </div>
      ) : null}

      {inviteOpen ? (
        <div className="oma-ws-overlay" role="presentation" onClick={() => setInviteOpen(false)}>
          <div
            className="oma-ws-modal-card oma-ws-modal-card--wide oma-invite-card"
            role="dialog"
            aria-modal="true"
            aria-label={t('team.invite_members')}
            onClick={(e) => e.stopPropagation()}
            style={{ margin: 'auto' }}
          >
            <div className="oma-ws-modal-head">
              <h3>{t('team.invite_members')}</h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                aria-label={t('brand.evidence.close')}
              >
                ×
              </button>
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">{t('auth.email')}</label>
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">{t('demo.team.filter.role')}</label>
              <div
                className="oma-role-cards"
                role="radiogroup"
                aria-label={t('demo.team.filter.role')}
              >
                {ROLE_OPTIONS.filter((r) => r !== 'Owner').map((r) => {
                  const perms = rolePermissions(r);
                  const on = PERM_COLS.filter((p) => perms[p]);
                  return (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={inviteRole === r}
                      className={`oma-role-card${inviteRole === r ? ' is-selected' : ''}`}
                      data-testid={`team-role-card-${r.toLowerCase()}`}
                      onClick={() => setInviteRole(r)}
                    >
                      <span className="oma-role-card__top">
                        <span className="oma-role-card__radio" aria-hidden="true" />
                        <strong>{t(`members.role.${r.toLowerCase()}`)}</strong>
                      </span>
                      <span className="oma-role-card__desc">
                        {t(`team.roleDesc.${r.toLowerCase()}`)}
                      </span>
                      <span className="oma-role-card__perms">
                        {on
                          .map((p) => (isAr ? PERMISSION_LABELS[p].ar : PERMISSION_LABELS[p].en))
                          .join(t('team.text'))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">{t('team.membership')}</label>
              <SelectField
                value={inviteMembership}
                onChange={(e) => setInviteMembership(e.target.value as MembershipType)}
              >
                <option value="team">{t('nav.team')}</option>
                <option value="client">{t('team.client')}</option>
              </SelectField>
            </div>
            <div className="oma-ws-modal-actions">
              <Button type="default" onClick={() => setInviteOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" onClick={() => void onInvite()} disabled={busy}>
                {busy ? t('auth.forgot.sending') : t('team.send_invite')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
