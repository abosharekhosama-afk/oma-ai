'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../lib/api';
import { apiMutate, getApiError, isPermissionDenied } from '../../../../../lib/brand-api';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';
import { PageHeader } from '../../../../../components/ui/page-header';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { useT } from '../../../../../lib/use-locale';

type Member = {
  id: string;
  status: string;
  invited_email: string | null;
  user: { id: string; email: string; name: string } | null;
  capabilities: string[];
  source_profiles: Array<string | null>;
};

const ASSIGNABLE_PROFILES = ['COMPANY_OWNER', 'MEMBER'] as const;

export default function CompanyMembersPage() {
  const t = useT();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [q, setQ] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [denied, setDenied] = useState(false);
  const [profileByMember, setProfileByMember] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await api<{ data: Member[] }>('/api/v1/tenants/current/memberships');
      setMembers(res.data);
      setError(null);
      setDenied(false);
    } catch (err) {
      if (isPermissionDenied(err)) setDenied(true);
      else setError(getApiError(err).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) => {
      const hay = [m.user?.email, m.user?.name, m.invited_email, ...(m.source_profiles ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [members, q]);

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
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // Clipboard may be denied; link remains visible.
    }
    setCopied(true);
  }

  async function suspend(id: string) {
    setBusy(true);
    try {
      await api(`/api/v1/memberships/${id}/suspend`, { method: 'POST', body: '{}' });
      await load();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function attachProfile(membershipId: string) {
    const profile_code = profileByMember[membershipId];
    if (!profile_code) return;
    setBusy(true);
    try {
      await apiMutate(`/api/v1/memberships/${membershipId}/profiles`, {
        method: 'POST',
        body: JSON.stringify({ profile_code }),
      });
      await load();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;

  return (
    <div className="oma-stack oma-members-foundation" data-testid="company-members">
      <PageHeader title={t('company.membersTitle')} description={t('company.membersBody')} />
      <p className="oma-honesty-inline">{t('company.foundationNote')}</p>

      {error ? (
        <div className="oma-settings-panel" role="alert" data-testid="company-members-error">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      <form className="oma-members-invite" onSubmit={invite} data-testid="company-members-invite">
        <h2>{t('company.inviteTitle')}</h2>
        <label className="oma-field">
          <span>{t('auth.email')}</span>
          <input
            className="oma-input"
            type="email"
            required
            value={email}
            data-testid="company-members-invite-email"
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <button
          type="submit"
          className="oma-btn"
          disabled={busy}
          data-testid="company-members-invite-submit"
        >
          {t('company.inviteSubmit')}
        </button>
        {inviteLink ? (
          <div role="status" className="oma-stack" data-testid="company-members-invite-link">
            <p className="oma-muted">{t('company.inviteLinkHint')}</p>
            <code className="oma-code-block">{inviteLink}</code>
            <button type="button" className="oma-btn oma-btn-secondary" onClick={copyLink}>
              {copied ? t('company.inviteCopied') : t('company.inviteCopy')}
            </button>
          </div>
        ) : null}
      </form>

      <div className="oma-stage6-toolbar">
        <label className="oma-stage6-search">
          {t('company.membersSearch')}
          <input
            className="oma-input"
            value={q}
            data-testid="company-members-search"
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      <div className="oma-members-table-wrap">
        <h2 className="oma-sr-only">{t('company.membersList')}</h2>
        {filtered.length === 0 ? (
          <p className="oma-muted" style={{ padding: 'var(--space-3)' }}>
            {t('company.membersEmpty')}
          </p>
        ) : (
          <table className="oma-table" data-testid="company-members-table">
            <thead>
              <tr>
                <th>{t('company.colPerson')}</th>
                <th>{t('company.colStatus')}</th>
                <th>{t('company.colProfile')}</th>
                <th>{t('company.colCapabilities')}</th>
                <th>{t('company.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} data-testid={`company-member-row-${m.id}`}>
                  <td>{m.user?.email ?? m.invited_email ?? m.id.slice(-8)}</td>
                  <td>
                    <StatusChip status={m.status} />
                  </td>
                  <td>{m.source_profiles.filter(Boolean).join(', ') || '—'}</td>
                  <td>
                    <span className="oma-muted" style={{ fontSize: 'var(--text-meta)' }}>
                      {m.capabilities.length > 0 ? m.capabilities.join(', ') : '—'}
                    </span>
                  </td>
                  <td>
                    <div className="oma-form-actions">
                      {m.status === 'ACTIVE' ? (
                        <>
                          <label className="oma-field">
                            <span className="oma-sr-only">{t('company.assignProfile')}</span>
                            <select
                              className="oma-input"
                              value={profileByMember[m.id] ?? ''}
                              data-testid={`assign-profile-${m.id}`}
                              onChange={(e) =>
                                setProfileByMember((prev) => ({ ...prev, [m.id]: e.target.value }))
                              }
                              disabled={busy}
                            >
                              <option value="">{t('company.assignProfilePlaceholder')}</option>
                              {ASSIGNABLE_PROFILES.map((code) => (
                                <option key={code} value={code}>
                                  {code}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="oma-btn oma-btn-secondary"
                            disabled={busy || !profileByMember[m.id]}
                            onClick={() => void attachProfile(m.id)}
                          >
                            {t('company.assignProfile')}
                          </button>
                          <button
                            type="button"
                            className="oma-btn oma-btn-secondary"
                            disabled={busy}
                            onClick={() => void suspend(m.id)}
                          >
                            {t('company.suspend')}
                          </button>
                        </>
                      ) : null}
                    </div>
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
