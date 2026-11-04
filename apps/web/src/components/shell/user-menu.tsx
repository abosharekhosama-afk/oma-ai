'use client';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getProfile, initials, type Profile } from '../../lib/account-api';
import { useT } from '../../lib/use-locale';
import { LanguageSwitcher } from './language-switcher';
import { LogoutButton } from './logout-button';
import { ShellIcon } from './shell-icons';
import { openSettings } from '../../lib/settings-dialog';
import { ShellPopover } from './shell-popover';

export function UserMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    let live = true;
    void getProfile()
      .then((p) => live && setProfile(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const panel = (
    <div className="oma-menu oma-user-menu-panel" role="menu" data-testid="shell-user-menu-panel">
      <p className="oma-user-menu-heading">{t('shell.account')}</p>
      <div className="oma-user-menu-row">
        <LanguageSwitcher />
      </div>
      <Link
        href="/app/account"
        className="oma-menu-item"
        role="menuitem"
        onClick={() => setOpen(false)}
      >
        {t('account.title')}
      </Link>
      <button
        type="button"
        className="oma-menu-item"
        role="menuitem"
        data-testid="shell-user-menu-settings"
        onClick={() => {
          setOpen(false);
          openSettings();
        }}
      >
        {t('nav.settings')}
      </button>
      <div className="oma-user-menu-row">
        <LogoutButton />
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
        <Button
          type="text"
          className="oma-rail-utility-trigger"
          aria-label={t('shell.account')}
          aria-expanded={open}
          aria-haspopup="menu"
          data-testid="shell-user-menu-trigger"
        >
          <span className="oma-avatar" aria-hidden="true">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : profile ? (
              initials(profile.name || profile.email)
            ) : (
              <ShellIcon name="user" size={16} />
            )}
          </span>
        </Button>
      </ShellPopover>
    </div>
  );
}
