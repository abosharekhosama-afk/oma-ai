'use client';

import { Button, Input, SelectField } from '@oma/ui/controls';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '../../../../../lib/use-locale';
import { ShellIcon } from '../../../../../components/shell/shell-icons';
import {
  attachMemberProfile,
  inviteMember,
  listWorkspaceMembers,
  removeMember,
  type WorkspaceMember,
} from '../../../../../lib/team-api';
import { isPermissionDenied } from '../../../../../lib/brand-api';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';

const COMPANY_ROLES = [
  { value: 'Administrator', profile: 'ADMIN', desc: 'Manage workspaces, people, and settings' },
  { value: 'Writer', profile: 'WRITER', desc: 'Edit access across workspaces' },
  { value: 'Contributor', profile: 'MEMBER', desc: 'Standard collaborator access' },
  { value: 'Owner', profile: 'COMPANY_OWNER', desc: 'Full company ownership' },
];

export default function CompanyMembersPage() {
  const t = useT();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Contributor');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listWorkspaceMembers();
      setMembers(data);
      setDenied(false);
    } catch (err) {
      if (isPermissionDenied(err)) setDenied(true);
      else setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => {
      const hay = [m.user?.email, m.user?.name, m.invited_email, m.role, ...(m.source_profiles || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [members, q]);

  async function onInvite() {
    if (!email.trim()) return;
    setBusy(true);
    setToast(null);
    setInviteLink(null);
    try {
      const res = (await inviteMember({
        email: email.trim(),
        role,
        membership: 'team',
      })) as { invite_token?: string; membership_id?: string };
      if (res?.invite_token) {
        setInviteLink(`${window.location.origin}/invite?token=${res.invite_token}`);
      }
      setToast('Invitation sent');
      setEmail('');
      setInviteOpen(false);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Invite failed');
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
      setToast('Role updated');
      await load();
    } catch {
      setToast('Role profile not available on server; UI updated');
    }
  }

  async function onRemove(member: WorkspaceMember) {
    const label = member.user?.email || member.invited_email || member.id;
    if (!window.confirm(`Remove ${label} from the company?`)) return;
    setBusy(true);
    try {
      await removeMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setToast('Member removed');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied />;

  return (
    <div className="oma-planable-page" data-testid="company-members-planable">
      <div className="oma-planable-page__header">
        <div>
          <h1 className="oma-planable-page__title">Company collaborators</h1>
          <p className="oma-planable-page__sub">
            Invite teammates at company level. They can be shared across workspaces under this
            account.
          </p>
        </div>
        <Button type="primary" onClick={() => setInviteOpen(true)} disabled={busy}>
          <ShellIcon name="plus" size={14} />
          <span>Invite collaborators</span>
        </Button>
      </div>

      {toast ? (
        <div className="oma-planable-toast" role="status">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      {inviteLink ? (
        <div className="oma-planable-card" style={{ marginBottom: 12 }}>
          <strong>Invite link</strong>
          <p className="oma-ws-empty-desc" style={{ marginTop: 6 }}>
            {inviteLink}
          </p>
          <Button
            type="default"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteLink);
              setToast('Link copied');
            }}
          >
            Copy link
          </Button>
        </div>
      ) : null}

      <div className="oma-planable-toolbar">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search collaborators…" />
      </div>

      {loading ? <div className="oma-skeleton" role="status" /> : null}
      {error ? (
        <div className="plx-empty" role="alert">
          <strong>{error}</strong>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="oma-planable-card">
          <table className="oma-ws-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Company role</th>
                <th>Status</th>
                <th>Capabilities</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="oma-ws-empty-block">
                      <h3>No collaborators yet</h3>
                      <p>Invite administrators or writers to manage workspaces together.</p>
                      <Button type="primary" onClick={() => setInviteOpen(true)}>
                        Invite collaborators
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
                        <SelectField
                          value={m.role || 'Contributor'}
                          onChange={(e) => void onRole(m, e.target.value)}
                        >
                          {COMPANY_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.value}
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
      ) : null}

      <div className="oma-ws-slack-card" style={{ marginTop: 16 }}>
        <div>
          <strong>Workspace team</strong>
          <p>
            For per-workspace Team/Client membership and permission grids, use the Team page.
          </p>
        </div>
        <Button type="default" onClick={() => (window.location.href = '/app/team')}>
          <ShellIcon name="team" size={14} />
          <span>Open Team</span>
        </Button>
      </div>

      {inviteOpen ? (
        <div className="oma-ws-overlay" role="presentation" onClick={() => setInviteOpen(false)}>
          <div
            className="oma-ws-modal-card"
            role="dialog"
            aria-label="Invite collaborators"
            onClick={(e) => e.stopPropagation()}
            style={{ margin: 'auto' }}
          >
            <div className="oma-ws-modal-head">
              <h3>Invite collaborators</h3>
              <button type="button" onClick={() => setInviteOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="oma-ws-field">
              <label className="oma-ws-label">Company role</label>
              <SelectField value={role} onChange={(e) => setRole(e.target.value)}>
                {COMPANY_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.value}
                  </option>
                ))}
              </SelectField>
              <p className="oma-muted" style={{ fontSize: 12, margin: 0 }}>
                {COMPANY_ROLES.find((r) => r.value === role)?.desc}
              </p>
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
