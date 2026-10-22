'use client';
import { Button, Input, SelectField } from '@oma/ui/controls';

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
    <div className="plx-page" data-testid="company-members" data-surface="company">
      <div className="plx-page__bar">
        <div className="plx-page__title-block">
          <h1 className="plx-page__title">{t('company.membersTitle')}</h1>
          <p className="plx-page__sub">{t('company.membersBody')}</p>
        </div>
      </div>

      <div className="plx-page__body">
        {error ? (
          <div className="plx-empty" role="alert" data-testid="company-members-error">
            <strong>{error}</strong>
          </div>
        ) : null}

        <form className="plx-toolbar" onSubmit={invite} style={{ marginBottom: 16 }}>
          <div className="plx-toolbar__search" style={{ flex: '1 1 240px' }}>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('company.inviteEmail')}
              data-testid="company-invite-email"
              disabled={busy}
            />
          </div>
          <Button type="primary" htmlType="submit" disabled={busy} data-testid="company-invite-submit">
            {t('company.invite')}
          </Button>
        </form>

        {inviteLink ? (
          <div className="plx-settings__panel" style={{ marginBottom: 16 }} data-testid="company-members-invite-link">
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>{t('company.inviteLinkHint')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ flex: 1, fontSize: 12, wordBreak: 'break-all' }}>{inviteLink}</code>
              <Button
                type="default"
                onClick={async () => {
                  await navigator.clipboard?.writeText(inviteLink);
                  setCopied(true);
                }}
              >
                {copied ? t('company.copied') : t('company.copyLink')}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="plx-toolbar" style={{ marginBottom: 16 }}>
          <div className="plx-toolbar__search">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('company.searchMembers')}
              data-testid="company-members-search"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="plx-empty">
            <strong>{t('company.noMembers')}</strong>
          </div>
        ) : (
          <div className="plx-list" data-testid="company-members-table">
            <div className="plx-list__head">
              <span>{t('company.col.member')}</span>
              <span>{t('company.col.status')}</span>
              <span>{t('company.col.profiles')}</span>
              <span>{t('company.col.capabilities')}</span>
              <span />
            </div>
            {filtered.map((m) => {
              const label = m.user?.name || m.user?.email || m.invited_email || m.id.slice(-8);
              const initial = (label || '?').trim().charAt(0).toUpperCase();
              return (
                <div key={m.id} className="plx-list__row" data-testid={`company-member-row-${m.id}`} style={{ cursor: 'default' }}>
                  <div className="plx-person">
                    <span className="plx-person__av" aria-hidden>
                      {initial}
                    </span>
                    <span>
                      <span className="plx-person__name">{label}</span>
                      <span className="plx-person__sub">{m.user?.email || m.invited_email || ''}</span>
                    </span>
                  </div>
                  <span className="plx-list__cell">
                    <StatusChip status={m.status} />
                  </span>
                  <span className="plx-list__cell">
                    {m.source_profiles.filter(Boolean).join(', ') || '—'}
                  </span>
                  <span className="plx-list__cell" style={{ fontSize: 12, color: '#9ca3af' }}>
                    {m.capabilities.length > 0 ? m.capabilities.slice(0, 3).join(', ') : '—'}
                  </span>
                  <span className="plx-list__actions">
                    {m.status === 'ACTIVE' ? (
                      <>
                        <SelectField
                          value={profileByMember[m.id] ?? ''}
                          data-testid={`assign-profile-${m.id}`}
                          onChange={(e) =>
                            setProfileByMember((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          disabled={busy}
                          aria-label={t('company.assignProfile')}
                          style={{ height: 32, fontSize: 12, maxWidth: 140 }}
                        >
                          <option value="">{t('company.assignProfilePlaceholder')}</option>
                          {ASSIGNABLE_PROFILES.map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </SelectField>
                        <Button
                          type="default"
                          disabled={busy || !profileByMember[m.id]}
                          onClick={() => void attachProfile(m.id)}
                          style={{ height: 32, fontSize: 12 }}
                        >
                          {t('company.assignProfile')}
                        </Button>
                        <Button type="default" disabled={busy} onClick={() => void suspend(m.id)} style={{ height: 32, fontSize: 12 }}>
                          {t('company.suspend')}
                        </Button>
                      </>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}
