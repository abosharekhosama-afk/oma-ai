'use client';
import { TableShimmer } from '../../../../components/ui/shimmer';

import { Button, Input, SelectField } from '@oma/ui/controls';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  attachMemberProfile,
  listWorkspaceMembers,
  permissionsToCapabilityCodes,
  removeMember,
  isOwnerMember,
  readablePermissions,
  updateMemberCapabilities,
  type PlanablePerm,
  type WorkspaceMember,
  PERMISSION_LABELS,
  capabilitiesToPermissions,
} from '../../../../lib/team-api';
import { Popover } from 'antd';
import {
  getPreferences,
  NOTIFICATION_PREF_TYPES,
  updatePreferences,
  type UserPreferences,
} from '../../../../lib/account-api';
import { TEAM_INVITE_EVENT } from '../../../../lib/team-invite';
import { TeamInviteDialog } from '../../../../components/team/team-invite-dialog';
import { useToast } from '../../../../components/ui/toast';
import { api } from '../../../../lib/api';
import { statusLabel } from '../../../../components/ui/status-chip';
import { useLocale, useT } from '../../../../lib/use-locale';

type Tab = 'members' | 'permissions' | 'notifications';

const NOTIF_GROUPS = [
  {
    id: 'content',
    labelKey: 'settings.notifications.group.content',
    types: NOTIFICATION_PREF_TYPES.filter(
      (type) => type.startsWith('content.') && !type.startsWith('content.publish'),
    ),
  },
  {
    id: 'publishing',
    labelKey: 'settings.notifications.group.publishing',
    types: NOTIFICATION_PREF_TYPES.filter((type) => type.startsWith('content.publish')),
  },
  {
    id: 'deliverables',
    labelKey: 'settings.notifications.group.deliverables',
    types: NOTIFICATION_PREF_TYPES.filter((type) => type.startsWith('deliverable.')),
  },
  {
    id: 'tasks',
    labelKey: 'settings.notifications.group.tasks',
    types: NOTIFICATION_PREF_TYPES.filter((type) => type.startsWith('task.')),
  },
] as const;

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
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('members');
  const [notif, setNotif] = useState<UserPreferences | null>(null);
  const [notifSaved, setNotifSaved] = useState<UserPreferences | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
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
  const [busy, setBusy] = useState(false);
  // The "Invite members" button lives in the shell header (replaces the generic Create button).
  useEffect(() => {
    const open = () => setInviteOpen(true);
    window.addEventListener(TEAM_INVITE_EVENT, open);
    return () => window.removeEventListener(TEAM_INVITE_EVENT, open);
  }, []);
  useEffect(() => {
    const next = searchParams.get('tab');
    if (next === 'members' || next === 'permissions' || next === 'notifications') setTab(next);
  }, [searchParams]);
  useEffect(() => {
    if (tab !== 'notifications') return;
    let cancelled = false;
    getPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setNotif(prefs);
        setNotifSaved(prefs);
      })
      .catch(() => {
        if (!cancelled) setNotif(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);
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

  async function onTogglePerm(member: WorkspaceMember, perm: PlanablePerm) {
    if (!member.permissions) return;
    if (isOwnerMember(member) && perm === 'admin' && member.permissions.admin) {
      toast.push(
        t('team.owner_admin_locked') ||
          (isAr ? 'لا يمكن إزالة صلاحيات المالك' : 'Owner admin access can’t be removed'),
        'danger',
      );
      return;
    }
    const next = { ...member.permissions, [perm]: !member.permissions[perm] };
    const nextCodes = permissionsToCapabilityCodes(next);
    setRows((prev) =>
      prev.map((r) =>
        r.id === member.id ? { ...r, permissions: next, capabilities: nextCodes } : r,
      ),
    );
    if (source !== 'api') return;
    try {
      await updateMemberCapabilities(member.id, nextCodes);
      toast.push(t('team.permissions_updated'), 'success');
      // Confirm from server so reload + enforcement match the matrix.
      await load(true);
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
    <div className="oma-bs" data-testid="team-page-planable">
      <header className="oma-bs-head">
        <div className="oma-bs-head__text">
          <h1 className="oma-bs-title">{t('wsPanel.team_clients')}</h1>
          <p className="oma-bs-sub">{t('team.invite_collaborators_set_teamclient_membership')}</p>
        </div>
      </header>
      <div className="oma-bs-body">
        <nav className="oma-bs-nav" aria-label={t('wsPanel.team_clients')}>
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
              className="oma-bs-nav__item"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              {t(label)}
            </button>
          ))}
        </nav>
        <main className="oma-bs-main">
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
                <div
                  className="oma-member-table-scroll"
                  role="region"
                  aria-label={t('team.user')}
                  tabIndex={0}
                  data-testid="team-members-scroll"
                >
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
                                    {email ? (
                                      <div className="oma-ws-user-email">{email}</div>
                                    ) : null}
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
              </div>
            </>
          ) : null}

          {!loading && !error && tab === 'permissions' ? (
            <div className="oma-planable-card oma-member-surface">
              <div
                className="oma-member-table-scroll"
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
                      const label =
                        m.user?.name || m.user?.email || m.invited_email || t('team.user');
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
            <div className="oma-planable-card oma-notif-settings" data-testid="team-notifications">
              <header className="oma-notif-settings__intro">
                <h3 className="oma-ws-subhead">{t('team.manage_notifications')}</h3>
                <p className="oma-ws-empty-desc">{t('settings.notifications.body')}</p>
              </header>
              {notif ? (
                <div className="oma-notif-settings__list" aria-busy={notifSaving || undefined}>
                  <div className="oma-notif-settings__section">
                    <div className="oma-notif-settings__row oma-notif-settings__row--master">
                      <div className="oma-notif-settings__copy">
                        <strong>{t('settings.notifications.all')}</strong>
                        <span>{t('settings.notifications.channel_inapp')}</span>
                      </div>
                      <label className="oma-switch">
                        <input
                          type="checkbox"
                          data-testid="notif-pref-all"
                          checked={notif.notifications.all !== false}
                          disabled={notifSaving}
                          onChange={(e) => {
                            const next = {
                              ...notif,
                              notifications: { ...notif.notifications, all: e.target.checked },
                            };
                            setNotif(next);
                            setNotifSaving(true);
                            void updatePreferences({ notifications: next.notifications })
                              .then((saved) => {
                                setNotif(saved);
                                setNotifSaved(saved);
                                toast.push(t('demo.settings.saved'), 'success');
                              })
                              .catch((err: unknown) => {
                                setNotif(notifSaved);
                                toast.push(
                                  err instanceof Error
                                    ? err.message
                                    : t('errors.page.generic.title'),
                                  'danger',
                                );
                              })
                              .finally(() => setNotifSaving(false));
                          }}
                        />
                        <span className="oma-switch__track" aria-hidden="true" />
                      </label>
                    </div>
                  </div>
                  {NOTIF_GROUPS.map((group) => {
                    const masterOn = notif.notifications.all !== false;
                    return (
                      <section key={group.id} className="oma-notif-settings__section">
                        <h4 className="oma-notif-settings__heading">{t(group.labelKey)}</h4>
                        <ul className="oma-notif-settings__rows">
                          {group.types.map((type) => {
                            const checked = masterOn && notif.notifications[type] !== false;
                            return (
                              <li
                                key={type}
                                className={`oma-notif-settings__row${masterOn ? '' : ' is-muted'}`}
                              >
                                <div className="oma-notif-settings__copy">
                                  <strong>{t(`shell.notificationPref.${type}`)}</strong>
                                  <span>{t('settings.notifications.channel_inapp')}</span>
                                </div>
                                <label className="oma-switch">
                                  <input
                                    type="checkbox"
                                    data-testid={`notif-pref-${type}`}
                                    disabled={!masterOn || notifSaving}
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = {
                                        ...notif,
                                        notifications: {
                                          ...notif.notifications,
                                          [type]: e.target.checked,
                                        },
                                      };
                                      setNotif(next);
                                      setNotifSaving(true);
                                      void updatePreferences({ notifications: next.notifications })
                                        .then((saved) => {
                                          setNotif(saved);
                                          setNotifSaved(saved);
                                          toast.push(t('demo.settings.saved'), 'success');
                                        })
                                        .catch((err: unknown) => {
                                          setNotif(notifSaved);
                                          toast.push(
                                            err instanceof Error
                                              ? err.message
                                              : t('errors.page.generic.title'),
                                            'danger',
                                          );
                                        })
                                        .finally(() => setNotifSaving(false));
                                    }}
                                  />
                                  <span className="oma-switch__track" aria-hidden="true" />
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="oma-skeleton" style={{ height: 160 }} aria-busy="true" />
              )}
            </div>
          ) : null}
        </main>
      </div>

      <TeamInviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={() => {
          void load(true);
          toast.push(t('team.invitation_sent'), 'success');
        }}
      />
    </div>
  );
}
