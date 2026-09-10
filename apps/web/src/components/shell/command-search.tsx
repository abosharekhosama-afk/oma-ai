'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog } from '../ui/dialog';
import { useT } from '../../lib/use-locale';
import { SHELL_NAV_SECTIONS } from './nav-config';

export function CommandSearch() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const entries = useMemo(() => {
    const flat = SHELL_NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        href: item.href,
        label: t(item.labelKey),
        section: t(section.labelKey),
      })),
    );
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter(
      (item) => item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q),
    );
  }, [query, t]);

  return (
    <>
      <button
        type="button"
        className="oma-command-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="oma-command-trigger-label">{t('shell.search')}</span>
        <kbd className="oma-command-kbd">⌘K</kbd>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('shell.searchTitle')}>
        <label className="oma-sr-only" htmlFor="oma-command-input">
          {t('shell.search')}
        </label>
        <input
          id="oma-command-input"
          className="oma-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('shell.searchPlaceholder')}
          autoFocus
        />
        <ul className="oma-command-results" role="listbox">
          {entries.length === 0 ? (
            <li className="oma-muted">{t('shell.searchEmpty')}</li>
          ) : (
            entries.map((item) => (
              <li key={item.href} role="option" aria-selected={pathname === item.href}>
                <button
                  type="button"
                  className="oma-menu-item"
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                    router.push(item.href);
                  }}
                >
                  <span>{item.label}</span>
                  <span className="oma-muted">{item.section}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </Dialog>
    </>
  );
}
