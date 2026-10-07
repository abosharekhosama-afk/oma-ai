'use client';
import { Button, Input } from '@oma/ui/controls';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog } from '../ui/dialog';
import { useT } from '../../lib/use-locale';
import { SHELL_NAV_SECTIONS } from './nav-config';

function navTestId(href: string) {
  return `demo-command-nav${href.split('/').join('-')}`;
}

export function CommandSearch({
  compact = false,
  hotkey = false,
}: {
  compact?: boolean;
  hotkey?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!hotkey) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey]);

  const entries = useMemo(() => {
    const flat = SHELL_NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        href: item.href,
        label: t(item.labelKey),
        section: t(section.labelKey),
        keywords: item.href === '/app/tasks' ? 'kanban board tasks board overdue production' : '',
      })),
    );
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q),
    );
  }, [query, t]);

  function closePalette() {
    setOpen(false);
    setQuery('');
  }

  function goTo(href: string) {
    // Navigate first — Modal destroyOnHidden must not race ahead of routing.
    router.push(href);
    closePalette();
  }

  return (
    <>
      <Button
        type="text"
        className={compact ? 'oma-rail-search' : 'oma-command-trigger'}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('shell.search')}
      >
        <span className="oma-command-trigger-label">{t('shell.search')}</span>
        {compact ? null : <kbd className="oma-command-kbd">⌘K</kbd>}
      </Button>
      <Dialog open={open} onClose={closePalette} title={t('shell.searchTitle')}>
        <label className="oma-sr-only" htmlFor="oma-command-input">
          {t('shell.search')}
        </label>
        <Input
          id="oma-command-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('shell.searchPlaceholder')}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && entries[0]) {
              e.preventDefault();
              goTo(entries[0].href);
            }
          }}
        />
        <ul className="oma-command-results" role="listbox">
          {entries.length === 0 ? (
            <li className="oma-muted">{t('shell.searchEmpty')}</li>
          ) : (
            entries.map((item) => (
              <li key={item.href} role="option" aria-selected={pathname === item.href}>
                {/* Real link navigation — Ant Button onClick inside Modal was failing to route in CI. */}
                <Link
                  href={item.href}
                  className="oma-menu-item"
                  data-testid={navTestId(item.href)}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(item.href);
                  }}
                >
                  <span>{item.label}</span>
                  <span className="oma-muted">{item.section}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </Dialog>
    </>
  );
}
