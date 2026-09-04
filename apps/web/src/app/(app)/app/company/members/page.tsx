'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../../../../lib/api';
import { useT } from '../../../../../lib/use-locale';

type Member = {
  id: string;
  status: string;
  invited_email: string | null;
  user: { id: string; email: string; name: string } | null;
  capabilities: string[];
  source_profiles: Array<string | null>;
};

export default function CompanyMembersPage() {
  const t = useT();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const res = await api<{ data: Member[] }>('/api/v1/tenants/current/memberships');
      setMembers(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setCopied(false);
    try {
      const res = await api<{ invite_token: string; membership_id: string }>(
        '/api/v1/tenants/current/invitations',
        { method: 'POST', body: JSON.stringify({ email }) },
      );
      const origin = window.location.origin;
      setInviteLink(`${origin}/app/onboarding?invite=${encodeURIComponent(res.invite_token)}`);
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
  }

  async function suspend(id: string) {
    setBusy(true);
    try {
      await api(`/api/v1/memberships/${id}/suspend`, { method: 'POST', body: '{}' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oma-stack">
      <header className="oma-page-header">
        <div>
          <h1>{t('company.membersTitle')}</h1>
          <p className="oma-muted">{t('company.membersBody')}</p>
        </div>
      </header>

      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      <form className="oma-card oma-stack" onSubmit={invite}>
        <h2>{t('company.inviteTitle')}</h2>
        <label className="oma-field">
          <span>{t('auth.email')}</span>
          <input
            className="oma-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" className="oma-btn" disabled={busy}>
          {t('company.inviteSubmit')}
        </button>
        {inviteLink ? (
          <div role="status" className="oma-stack">
            <p className="oma-muted">{t('company.inviteLinkHint')}</p>
            <code className="oma-code-block">{inviteLink}</code>
            <button type="button" className="oma-btn oma-btn-secondary" onClick={copyLink}>
              {copied ? t('company.inviteCopied') : t('company.inviteCopy')}
            </button>
          </div>
        ) : null}
      </form>

      <div className="oma-card">
        <h2>{t('company.membersList')}</h2>
        {members.length === 0 ? (
          <p className="oma-muted">{t('company.membersEmpty')}</p>
        ) : (
          <table className="oma-table">
            <thead>
              <tr>
                <th>{t('company.colPerson')}</th>
                <th>{t('company.colStatus')}</th>
                <th>{t('company.colProfile')}</th>
                <th>{t('company.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user?.email ?? m.invited_email ?? m.id.slice(-8)}</td>
                  <td>
                    <span className="oma-badge">{m.status}</span>
                  </td>
                  <td>{m.source_profiles.filter(Boolean).join(', ') || '—'}</td>
                  <td>
                    {m.status === 'ACTIVE' ? (
                      <button
                        type="button"
                        className="oma-btn oma-btn-secondary"
                        disabled={busy}
                        onClick={() => void suspend(m.id)}
                      >
                        {t('company.suspend')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
