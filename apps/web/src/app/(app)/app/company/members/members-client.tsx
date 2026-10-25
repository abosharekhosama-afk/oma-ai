'use client';

import { Button, Input, SelectField } from '@oma/ui/controls';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ShellIcon } from '../../../../../components/shell/shell-icons';
import {
  attachMemberProfile,
  inviteMember,
  listWorkspaceMembers,
  removeMember,
  type WorkspaceMember,
} from '../../../../../lib/team-api';
import { useToast } from '../../../../../components/ui/toast';
import { isPermissionDenied } from '../../../../../lib/brand-api';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';
import { useT } from '../../../../../lib/use-locale';

const COMPANY_ROLES = [
  {
    value: 'Owner',
    profile: 'COMPANY_OWNER',
    kind: 'team' as const,
    desc: 'members.role.owner_desc',
  },
  {
    value: 'Administrator',
    profile: 'ADMIN',
    kind: 'team' as const,
    desc: 'members.role.admin_desc',
  },
  {
    value: 'Writer',
    profile: 'WRITER',
    kind: 'team' as const,
    desc: 'members.role.writer_desc',
  },
  {
    value: 'Approver',
    profile: 'APPROVER',
    kind: 'team' as const,
    desc: 'members.role.approver_desc',
  },
  {
    value: 'Contributor',
    profile: 'MEMBER',
    kind: 'team' as const,
    desc: 'members.role.contributor_desc',
  },
  {
    value: 'Client',
    profile: 'CLIENT',
    kind: 'client' as const,
    desc: 'members.role.client_desc',
  },
  { value: 'Guest', profile: 'GUEST', kind: 'client' as const, desc: 'members.limited_view_access' },
];

export default function CompanyMembersPage() {
  const t = useT();
  const toast = useToast();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Contributor');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
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
      setMembers(data);
      setDenied(false);
    } catch (err) {
      if (!mountedRef.current) return;
      if (isPermissionDenied(err)) setDenied(true);
      else setError(err instanceof Error ? err.message : t('members.failed_to_load_members'));
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
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => {
      const hay = [
        m.user?.email,
        m.user?.name,
        m.invited_email,
        m.role,
        ...(m.source_profiles || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [members, q]);

  async function onInvite() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setInviteLink(null);
    try {
      const roleMeta = COMPANY_ROLES.find((r) => r.value === role);
      const res = (await inviteMember({
        email: email.trim(),
        role,
        membership: roleMeta?.kind === 'client' ? 'client' : 'team',
      })) as { invite_token?: string };
      if (res?.invite_token) {
        setInviteLink(`${window.location.origin}/invite?token=${res.invite_token}`);
      }
      toast.push(t('team.invitation_sent'), 'success');
      setEmail('');
      setInviteOpen(false);
      await load(true);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.invite_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function onRole(member: WorkspaceMember, nextRole: string) {
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: nextRole } : m)));
    const profile = COMPANY_ROLES.find((r) => r.value === nextRole)?.profile;
    if (!profile) return;
    try {
      await attachMemberProfile(member.id, profile);
      toast.push(t('team.role_updated'), 'success');
    } catch {
      toast.push('Role profile not available on server; UI updated', 'success');
    }
  }

  async function onRemove(member: WorkspaceMember) {
    const label = member.user?.email || member.invited_email || member.id;
    if (!window.confirm(t('members.confirm_remove').replace('{name}', label))) return;
    setBusy(true);
    try {
      await removeMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.push(t('team.member_removed'), 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : t('errors.remove_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied />;

  return (
    <div className="oma-planable-page" data-testid="company-members-planable">
      <div className="oma-planable-page__header">
        <div>
          <h1 className="oma-planable-page__title">{t('wsPanel.company_collaborators')}</h1>
          <p className="oma-planable-page__sub">
            Invite teammates at company level. They can be shared across workspaces under this
            account.
          </p>
        </div>
        <Button type="primary" onClick={() => setInviteOpen(true)} disabled={busy}>
          <ShellIcon name="plus" size={14} />
          <span>{t('members.invite_collaborators')}</span>
        </Button>
      </div>

      {inviteLink ? (
        <div className="oma-planable-card" style={{ marginBottom: 12 }}>
          <strong>{t('members.invite_link')}</strong>
          <p className="oma-ws-empty-desc" style={{ marginTop: 6 }}>
            {inviteLink}
          </p>
          <Button
            type="default"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteLink);
                toast.push(t('content.link_copied'), 'success');
              } catch {
                toast.push(t('members.could_not_copy'), 'danger');
              }
            }}
          >
            {t('demo.tasks.copyLink')}
          </Button>
        </div>
      ) : null}

      <div className="oma-planable-toolbar">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('members.search_collaborators')}
        />
      </div>

      {loading ? <div className="oma-skeleton" role="status" /> : null}
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

      {!loading && !error ? (
        <div className="oma-planable-card oma-member-surface">
          <table className="oma-ws-table">
            <thead>
              <tr>
                <th>{t('team.user')}</th>
                <th>{t('members.company_role')}</th>
                <th>{t('strategy.list.col.status')}</th>
                <th>{t('company.colCapabilities')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="oma-ws-empty-block">
                      <h3>{t('members.no_collaborators_yet')}</h3>
                      <p>{t('members.invite_administrators_or_writers_to')}</p>
                      <Button type="primary" onClick={() => setInviteOpen(true)}>
                        {t('members.invite_collaborators')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const label = m.user?.name || m.user?.email || m.invited_email || t('team.user');
                  const email = m.user?.email || m.invited_email || '';
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="oma-ws-user-cell">
                          <span className="oma-ws-avatar oma-ws-avatar--sm">
                            {(label[0] || 'U').toUpperCase()}
                          </span>
                          <div>
                            <div className="oma-ws-user-name">{label}</div>
                            {email ? <div className="oma-ws-user-email">{email}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <SelectField
                          value={m.role || 'Contributor'}
                          onChange={(e) => void onRole(m, e.target.value)}
                        >
                          {COMPANY_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {t(`members.role.${r.value.toLowerCase()}`)}
                            </option>
                          ))}
                        </SelectField>
                      </td>
                      <td>
                        <span className="oma-ws-badge oma-ws-badge--ghost">{m.status}</span>
                      </td>
                      <td>
                        <span className="oma-muted" style={{ fontSize: 12 }}>
                          {(m.capabilities || []).slice(0, 4).join(', ') || '—'}
                          {(m.capabilities || []).length > 4 ? '…' : ''}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="oma-ws-danger-btn"
                          disabled={busy}
                          onClick={() => void onRemove(m)}
                        >
                          {t('team.remove')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="oma-ws-slack-card" style={{ marginTop: 16 }}>
        <div>
          <strong>{t('members.workspace_team')}</strong>
          <p>{t('members.for_perworkspace_teamclient_membership_and')}</p>
        </div>
        <Button type="default" onClick={() => (window.location.href = '/app/team')}>
          <ShellIcon name="team" size={14} />
          <span>{t('wsPanel.open_team')}</span>
        </Button>
      </div>

      {inviteOpen ? (
        <div className="oma-ws-overlay" role="presentation" onClick={() => setInviteOpen(false)}>
          <div
            className="oma-ws-modal-card"
            role="dialog"
            aria-label={t('members.invite_collaborators')}
            onClick={(e) => e.stopPropagation()}
            style={{ margin: 'auto' }}
          >
            <div className="oma-ws-modal-head">
              <h3>{t('members.invite_collaborators')}</h3>
              <button type="button" onClick={() => setInviteOpen(false)} aria-label={t('brand.evidence.close')}>
                ×
              </button>
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">{t('auth.email')}</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">{t('members.company_role')}</label>
              <SelectField value={role} onChange={(e) => setRole(e.target.value)}>
                {COMPANY_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(`members.role.${r.value.toLowerCase()}`)}
                  </option>
                ))}
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
