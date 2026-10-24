'use client';

import { Button, Input, SelectField } from '@oma/ui/controls';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OmaTopLoader } from '../../../../components/ui/oma-top-loader';
import {
  attachMemberProfile,
  inviteMember,
  listWorkspaceMembers,
  permissionsToCapabilityCodes,
  removeMember,
  updateMemberCapabilities,
  type MembershipType,
  type PlanablePerm,
  type WorkspaceMember,
} from '../../../../lib/team-api';
import { useToast } from '../../../../components/ui/toast';
import { demoApi, demoErrorMessage, isDemoForbidden } from '../../../../lib/demo/use-demo-api';
import { ShellIcon } from '../../../../components/shell/shell-icons';

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

export default function TeamPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('members');
  const [rows, setRows] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'demo'>('api');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Contributor');
  const [inviteMembership, setInviteMembership] = useState<MembershipType>('team');
  const [busy, setBusy] = useState(false);
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
      setSource('api');
    } catch {
      try {
        const demo = await demoApi<
          Array<{
            id: string;
            name?: string;
            email?: string;
            role?: string;
            status?: string;
          }>
        >('/team');
        if (!mountedRef.current) return;
        setRows(
          demo.map((m) => ({
            id: m.id,
            status: m.status || 'ACTIVE',
            invited_email: m.email,
            user: { id: m.id, email: m.email || '', name: m.name || null },
            capabilities: [],
            source_profiles: m.role ? [m.role] : [],
            role: m.role || 'Member',
            membership: 'team' as const,
            permissions: {
              view: true,
              approve: false,
              edit: true,
              publish: false,
              analyze: false,
              engage: false,
              admin: false,
            },
            last_online: '—',
          })),
        );
        setSource('demo');
      } catch (demoErr) {
        if (!mountedRef.current) return;
        if (isDemoForbidden(demoErr)) setError('Unavailable');
        else setError(demoErrorMessage(demoErr, 'Failed to load team'));
      }
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
            permissions: {
              view: true,
              approve: inviteRole === 'Approver' || inviteRole === 'Administrator',
              edit: !['Guest', 'Approver'].includes(inviteRole),
              publish: ['Contributor', 'Administrator', 'Owner'].includes(inviteRole),
              analyze: ['Administrator', 'Owner'].includes(inviteRole),
              engage: false,
              admin: ['Administrator', 'Owner'].includes(inviteRole),
            },
            last_online: 'Invited',
          },
        ]);
      }
      setInviteOpen(false);
      setInviteEmail('');
      toast.push('Invitation sent', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Invite failed', 'danger');
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
      toast.push('Permissions updated', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed', 'danger');
      await load(true);
    }
  }

  async function onRemove(member: WorkspaceMember) {
    if (!window.confirm(`Remove ${member.user?.email || member.invited_email}?`)) return;
    setBusy(true);
    try {
      if (source === 'api') await removeMember(member.id);
      setRows((prev) => prev.filter((r) => r.id !== member.id));
      toast.push('Member removed', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Remove failed', 'danger');
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
      toast.push('Role updated', 'success');
    } catch {
      toast.push('Role profile not available; UI updated only', 'success');
    }
  }

  return (
    <div className="oma-planable-page" data-testid="team-page-planable">
      <div className="oma-planable-page__header">
        <div>
          <h1 className="oma-planable-page__title">Team & clients</h1>
          <p className="oma-planable-page__sub">
            Invite collaborators, set Team/Client membership, and adjust permissions.
            {source === 'demo' ? ' (demo data)' : null}
          </p>
        </div>
        <Button type="primary" onClick={() => setInviteOpen(true)} disabled={busy}>
          <ShellIcon name="plus" size={14} />
          <span>Invite members</span>
        </Button>
      </div>

      <div className="oma-ws-tabs">
        {(
          [
            ['members', 'Members'],
            ['permissions', 'Permissions'],
            ['notifications', 'Notifications'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`oma-ws-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <OmaTopLoader /> : null}
      {error ? (
        <div className="plx-empty" role="alert">
          <strong>{error}</strong>
          <div style={{ marginTop: 12 }}>
            <Button type="default" onClick={() => void load(true)}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && !error && tab === 'members' ? (
        <>
          <div className="oma-planable-toolbar">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members…" />
          </div>
          <div className="oma-planable-card oma-member-surface">
            <table className="oma-ws-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Membership</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last online</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="oma-ws-empty-block">
                        <h3>No members yet</h3>
                        <p>Invite teammates or clients to collaborate in this workspace.</p>
                        <Button type="primary" onClick={() => setInviteOpen(true)}>
                          Invite members
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const label = m.user?.name || m.user?.email || m.invited_email || 'User';
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
                          <span
                            className={`oma-ws-badge${
                              m.membership === 'client' ? ' oma-ws-badge--client' : ''
                            }`}
                          >
                            {m.membership === 'client' ? 'Client' : 'Team'}
                          </span>
                        </td>
                        <td>
                          <SelectField
                            value={m.role || 'Member'}
                            onChange={(e) => void onChangeRole(m, e.target.value)}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </SelectField>
                        </td>
                        <td>
                          <span className="oma-ws-badge oma-ws-badge--ghost">{m.status}</span>
                        </td>
                        <td>{m.last_online || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="oma-ws-danger-btn"
                            onClick={() => void onRemove(m)}
                            disabled={busy}
                          >
                            Remove
                          </button>
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
          <h3 className="oma-ws-subhead">Adjust permissions</h3>
          <p className="oma-ws-empty-desc">
            Set who can view, approve, edit, publish, analyze, engage, and administer the workspace.
          </p>
          <table className="oma-ws-table oma-ws-table--perms">
            <thead>
              <tr>
                <th>User</th>
                {PERM_COLS.map((p) => (
                  <th key={p}>{p[0].toUpperCase() + p.slice(1)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const label = m.user?.name || m.user?.email || m.invited_email || 'User';
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
      ) : null}

      {!loading && !error && tab === 'notifications' ? (
        <div className="oma-planable-card">
          <h3 className="oma-ws-subhead">Manage notifications</h3>
          <p className="oma-ws-empty-desc">
            Choose which events each member receives. Connect Slack from Settings → Integrations.
          </p>
          <table className="oma-ws-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Posts updates</th>
                <th>Approvals</th>
                <th>Your posts</th>
                <th>Other posts</th>
                <th>Social inbox</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const label = m.user?.name || m.user?.email || m.invited_email || 'User';
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="oma-ws-user-cell">
                        <span className="oma-ws-avatar oma-ws-avatar--sm">
                          {(label[0] || 'U').toUpperCase()}
                        </span>
                        <div className="oma-ws-user-name">{label}</div>
                      </div>
                    </td>
                    {['posts', 'approvals', 'yours', 'others', 'inbox'].map((k) => (
                      <td key={k} className="oma-ws-check-cell">
                        <input
                          type="checkbox"
                          defaultChecked={k === 'approvals' || k === 'yours'}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {inviteOpen ? (
        <div className="oma-ws-overlay" role="presentation" onClick={() => setInviteOpen(false)}>
          <div
            className="oma-ws-modal-card"
            role="dialog"
            aria-label="Invite members"
            onClick={(e) => e.stopPropagation()}
            style={{ margin: 'auto' }}
          >
            <div className="oma-ws-modal-head">
              <h3>Invite members</h3>
              <button type="button" onClick={() => setInviteOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">Email</label>
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">Role</label>
              <SelectField value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">Membership</label>
              <SelectField
                value={inviteMembership}
                onChange={(e) => setInviteMembership(e.target.value as MembershipType)}
              >
                <option value="team">Team</option>
                <option value="client">Client</option>
              </SelectField>
            </div>
            <div className="oma-ws-modal-actions">
              <Button type="default" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="primary" onClick={() => void onInvite()} disabled={busy}>
                {busy ? 'Sending…' : 'Send invite'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
