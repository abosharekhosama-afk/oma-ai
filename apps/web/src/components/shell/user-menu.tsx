'use client';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/use-locale';
import { LanguageSwitcher } from './language-switcher';
import { LogoutButton } from './logout-button';
import { ShellIcon } from './shell-icons';

export function UserMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="oma-user-menu" ref={rootRef}>
      <Button
        type="text"
        aria-label={t('shell.account')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="oma-avatar" aria-hidden="true">
          <ShellIcon name="user" size={16} />
        </span>
      </Button>
      {open ? (
        <div className="oma-menu oma-user-menu-panel" role="menu">
          <p className="oma-user-menu-heading">{t('shell.account')}</p>
          <div className="oma-user-menu-row">
            <LanguageSwitcher />
          </div>
          <Link
            href="/app/settings"
            className="oma-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            {t('nav.settings')}
          </Link>
          <Link
            href="/app/company/members"
            className="oma-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            {t('nav.company')}
          </Link>
          <div className="oma-user-menu-row">
            <LogoutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
