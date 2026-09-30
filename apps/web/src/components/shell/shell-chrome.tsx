'use client';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { OmaLinkButton } from '../ui/oma-link-button';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Drawer } from '../ui/drawer';
import { ToastProvider } from '../ui/toast';
import { useT } from '../../lib/use-locale';
import { BrandContext } from './brand-context';
import { CommandSearch } from './command-search';
import { NavLink } from './nav-link';
import { NotificationsBell } from './notifications-bell';
import { SHELL_NAV_SECTIONS, SHELL_RAIL_PREF_KEY } from './nav-config';
import { ShellIcon } from './shell-icons';
import { TenantSwitcher } from './tenant-switcher';
import { UserMenu } from './user-menu';

function RailNav({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  return (
    <nav className="oma-nav" aria-label={t('nav.primary')}>
      {SHELL_NAV_SECTIONS.map((section) => (
        <div key={section.id} className="oma-nav-group">
          <p className="oma-nav-section" id={`nav-${section.id}`}>
            {t(section.labelKey)}
          </p>
          <ul className="oma-nav-list" aria-labelledby={`nav-${section.id}`}>
            {section.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  label={t(item.labelKey)}
                  icon={item.icon}
                  collapsed={collapsed}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ShellBreadcrumb() {
  const t = useT();
  const pathname = usePathname() || '/app';
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const href = `/${segments.slice(0, idx + 1).join('/')}`;
    const key = `nav.${seg}`;
    const translated = t(key);
    let label = seg;
    if (seg === 'app') label = t('nav.home');
    else if (translated !== key) label = translated;
    else if (seg === 'members') label = t('nav.company');
    else if (seg === 'brands') label = t('nav.intelligence');
    return { href, label, current: idx === segments.length - 1 };
  });

  return (
    <nav aria-label={t('shell.breadcrumb')} className="oma-context-trail">
      <ol className="oma-breadcrumb">
        {crumbs.map((c, i) => (
          <li key={`${c.href}-${i}`}>
            {i > 0 ? (
              <span className="oma-breadcrumb-sep" aria-hidden="true">
                /
              </span>
            ) : null}
            {c.current ? (
              <span aria-current="page">{c.label}</span>
            ) : (
              <Link href={c.href}>{c.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ShellChrome({ children }: { children: ReactNode }) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = window.localStorage.getItem(SHELL_RAIL_PREF_KEY);
      if (raw === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SHELL_RAIL_PREF_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <ToastProvider>
      <div
        className="oma-shell"
        data-rail={collapsed ? 'collapsed' : 'expanded'}
        data-shell-hydrated={hydrated ? 'true' : 'false'}
      >
        <aside
          className="oma-rail"
          aria-label={t('nav.primary')}
          data-collapsed={collapsed}
          data-testid="oma-rail"
        >
          <div className="oma-rail-header">
            <div className="oma-rail-brand">
              <span className="oma-rail-mark" aria-hidden="true">
                OMA
              </span>
              <span className="oma-rail-name">{t('app.name')}</span>
            </div>
            <Button
              type="text"
              aria-label={collapsed ? t('shell.expandNav') : t('shell.collapseNav')}
              aria-pressed={collapsed}
              onClick={toggleCollapsed}
              className="oma-rail-collapse"
            >
              <ShellIcon name="collapse" />
            </Button>
          </div>
          <p className="oma-rail-endorsement">{t('app.endorsement')}</p>
          <div className="oma-rail-workspace">
            <TenantSwitcher />
          </div>
          <CommandSearch compact hotkey />
          <RailNav collapsed={collapsed} />
          <div className="oma-rail-footer">
            <NotificationsBell />
            <UserMenu />
          </div>
        </aside>

        <div className="oma-shell-column">
          <header className="oma-top">
            <div className="oma-top-start">
              <Button
                type="text"
                aria-label={t('shell.openNav')}
                onClick={() => setMobileOpen(true)}
                className="oma-mobile-nav-trigger"
              >
                <ShellIcon name="menu" />
              </Button>
              <div className="oma-top-context">
                <BrandContext />
                <ShellBreadcrumb />
              </div>
            </div>
            <div className="oma-top-center">
              <CommandSearch compact />
            </div>
            <div className="oma-top-actions">
              <OmaLinkButton href="/app/requests" type="primary" data-testid="shell-create">
                <ShellIcon name="plus" size={16} />
                <span>{t('shell.create')}</span>
              </OmaLinkButton>
            </div>
          </header>
          <main id="main" className="oma-container">
            {children}
          </main>
        </div>

        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} label={t('nav.primary')} nav>
          <div className="oma-mobile-drawer-header">
            <span className="oma-rail-name">{t('app.name')}</span>
            <Button
              type="text"
              aria-label={t('shell.closeNav')}
              onClick={() => setMobileOpen(false)}
            >
              ×
            </Button>
          </div>
          <div className="oma-rail-workspace">
            <TenantSwitcher />
          </div>
          <CommandSearch compact />
          <div className="oma-mobile-drawer-nav" onClick={() => setMobileOpen(false)}>
            <RailNav collapsed={false} />
          </div>
          <div className="oma-rail-footer">
            <NotificationsBell />
            <UserMenu />
          </div>
        </Drawer>
      </div>
    </ToastProvider>
  );
}
