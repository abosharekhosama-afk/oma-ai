'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getProfile, initials, type Profile } from '../../lib/account-api';
import { SESSION_OK_KEY } from '../../lib/session';
import { useT } from '../../lib/use-locale';
import { ShellIcon } from './shell-icons';
import { ShellPopover } from './shell-popover';

export function UserMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let live = true;
    void getProfile()
      .then((p) => live && setProfile(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setOpen(false);
    try {
      await api('/api/v1/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      /* already signed out / offline: still leave */
    }
    try {
      window.sessionStorage.removeItem(SESSION_OK_KEY);
    } catch {
      /* ignore */
    }
    window.location.href = '/login';
  }

  const displayName = profile?.name?.trim() || profile?.email?.split('@')[0] || t('shell.account');
  const displayEmail = profile?.email ?? '';
  const avatarInitials = profile ? initials(profile.name || profile.email) : '';

  const panel = (
    <div
      className="oma-menu oma-user-menu-panel oma-plx-account-card"
      role="menu"
      data-testid="shell-user-menu-panel"
    >
      <div className="oma-plx-account-card__header">
        <span className="oma-plx-account-card__avatar" aria-hidden="true">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : avatarInitials ? (
            avatarInitials
          ) : (
            <ShellIcon name="user" size={16} />
          )}
        </span>
        <div className="oma-plx-account-card__identity">
          <strong className="oma-plx-account-card__name">{displayName}</strong>
          {displayEmail ? (
            <span className="oma-plx-account-card__email">{displayEmail}</span>
          ) : null}
        </div>
      </div>

      <div className="oma-plx-account-card__items">
        <Link
          href="/app/account"
          className="oma-plx-account-card__item"
          role="menuitem"
          data-testid="shell-user-menu-profile"
          onClick={() => setOpen(false)}
        >
          <span className="oma-plx-account-card__icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </span>
          <span className="oma-plx-account-card__label">
            {t('shell.profile_settings') || 'Profile settings'}
          </span>
        </Link>

        <Link
          href="/app/billing"
          className="oma-plx-account-card__item"
          role="menuitem"
          data-testid="shell-user-menu-billing"
          onClick={() => setOpen(false)}
        >
          <span className="oma-plx-account-card__icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M15 9.35a3.5 3.5 0 0 0-3-1.35c-1.66 0-3 .9-3 2.25 0 1.5 1.5 2 3 2.5s3 1 3 2.5c0 1.35-1.34 2.25-3 2.25a3.5 3.5 0 0 1-3-1.35" />
              <path d="M12 6.5v11" />
            </svg>
          </span>
          <span className="oma-plx-account-card__label">{t('shell.billing') || 'Billing'}</span>
          <span className="oma-plx-account-card__chev" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </Link>

        <button
          type="button"
          className="oma-plx-account-card__item oma-plx-account-card__item--logout"
          role="menuitem"
          data-testid="shell-user-menu-logout"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
        >
          <span className="oma-plx-account-card__icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          <span className="oma-plx-account-card__label">{t('shell.logout')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="oma-user-menu">
      <ShellPopover
        open={open}
        onOpenChange={setOpen}
        content={panel}
        className="oma-user-menu-pop"
      >
        <button
          type="button"
          className="oma-rail-utility-trigger oma-plx-account-trigger"
          aria-label={t('shell.account')}
          aria-expanded={open}
          aria-haspopup="menu"
          data-testid="shell-user-menu-trigger"
        >
          <span className="oma-avatar oma-plx-account-trigger__avatar" aria-hidden="true">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : avatarInitials ? (
              avatarInitials
            ) : (
              <ShellIcon name="user" size={14} />
            )}
          </span>
          <span className="oma-plx-account-trigger__name">{displayName}</span>
          <span className="oma-plx-account-trigger__chev" aria-hidden="true">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </span>
        </button>
      </ShellPopover>
    </div>
  );
}
