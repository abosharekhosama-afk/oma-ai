'use client';

import { Button, Input, SelectField } from '@oma/ui/controls';
import { useState } from 'react';
import {
  inviteMember,
  PERMISSION_LABELS,
  type MembershipType,
  type PlanablePerm,
} from '../../lib/team-api';
import { useLocale, useT } from '../../lib/use-locale';

const PERM_COLS: PlanablePerm[] = [
  'view',
  'approve',
  'edit',
  'publish',
  'analyze',
  'engage',
  'admin',
];

const ROLE_OPTIONS = ['Administrator', 'Contributor', 'Writer', 'Approver', 'Guest'];

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

/** The members-page invite card. Used by Team and by every workspace invite button. */
export function TeamInviteDialog({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
}) {
  const t = useT();
  const isAr = useLocale().toLowerCase().startsWith('ar');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Contributor');
  const [membership, setMembership] = useState<MembershipType>('team');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function send() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await inviteMember({ email: email.trim(), role, membership });
      setEmail('');
      onSent?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.invite_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oma-ws-overlay" role="presentation" onClick={onClose}>
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
          <button type="button" onClick={onClose} aria-label={t('brand.evidence.close')}>
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
          <label className="oma-ws-label">{t('demo.team.filter.role')}</label>
          <div className="oma-role-cards" role="radiogroup" aria-label={t('demo.team.filter.role')}>
            {ROLE_OPTIONS.map((r) => {
              const perms = rolePermissions(r);
              const on = PERM_COLS.filter((p) => perms[p]);
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  className={`oma-role-card${role === r ? ' is-selected' : ''}`}
                  data-testid={`team-role-card-${r.toLowerCase()}`}
                  onClick={() => setRole(r)}
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
            value={membership}
            onChange={(e) => setMembership(e.target.value as MembershipType)}
          >
            <option value="team">{t('nav.team')}</option>
            <option value="client">{t('team.client')}</option>
          </SelectField>
        </div>
        {error ? (
          <p className="plx-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="oma-ws-modal-actions">
          <Button type="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" onClick={() => void send()} disabled={busy}>
            {busy ? t('auth.forgot.sending') : t('team.send_invite')}
          </Button>
        </div>
      </div>
    </div>
  );
}
