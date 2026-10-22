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
import { UserMenu } from './user-menu';
import { WorkspaceRow } from './workspace-row';
import { WorkspaceSettingsPanel } from './workspace-settings-panel';
import { PlxLogo } from '../ui/plx-icons';

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
  const isContent = pathname === '/app/content' || pathname.startsWith('/app/content/');
  const isDeliverables =
    pathname === '/app/deliverables' || pathname.startsWith('/app/deliverables/');
  const isTasks = pathname === '/app/tasks' || pathname.startsWith('/app/tasks/');

  /* Planable trail: Workspace / Section / View — view switch lives in path */
  if (isContent || isDeliverables || isTasks) {
    const sectionHref = isContent
      ? '/app/content'
      : isDeliverables
        ? '/app/deliverables'
        : '/app/tasks';
    const sectionLabel = isContent
      ? t('nav.content') || 'Content'
      : isDeliverables
        ? t('nav.deliverables') || t('demo.deliverables.title') || 'Deliverables'
        : t('nav.tasks') || t('demo.tasks.title') || 'Tasks';
    const defaultView = isContent ? 'Calendar' : isDeliverables ? 'Grid' : 'Board';
    return (
      <nav aria-label={t('shell.breadcrumb')} className="oma-context-trail oma-context-trail--content">
        <ol className="oma-breadcrumb oma-breadcrumb--planable">
          <li>
            <span className="oma-breadcrumb-workspace">
              <span className="oma-breadcrumb-workspace-mark" aria-hidden />
              <span>Osama</span>
              <span className="oma-breadcrumb-caret" aria-hidden>
                ▾
              </span>
            </span>
          </li>
          <li>
            <span className="oma-breadcrumb-sep" aria-hidden>
              /
            </span>
            <Link href={sectionHref}>{sectionLabel}</Link>
          </li>
          <li>
            <span className="oma-breadcrumb-sep" aria-hidden>
              /
            </span>
            <span
              className="oma-breadcrumb-view"
              id="oma-content-view-slot"
              data-testid="shell-content-view-slot"
              data-default-view={defaultView}
            />
          </li>
        </ol>
      </nav>
    );
  }

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
  const pathname = usePathname() || '/app';
  const isContentWorkspace = pathname === '/app/content' || pathname.startsWith('/app/content/');
  const isRequestsWorkspace = pathname === '/app/requests' || pathname.startsWith('/app/requests/');
  const isDeliverablesWorkspace =
    pathname === '/app/deliverables' || pathname.startsWith('/app/deliverables/');
  const isTasksWorkspace = pathname === '/app/tasks' || pathname.startsWith('/app/tasks/');
  const isBrandsList = pathname === '/app/brands' || pathname === '/app/brands/';
  const isBrandDetail =
    pathname.startsWith('/app/brands/') &&
    pathname !== '/app/brands/new' &&
    !pathname.startsWith('/app/brands/new/');
  const isCampaignsWorkspace =
    pathname === '/app/campaigns' || pathname.startsWith('/app/campaigns/');
  const brandIdFromPath = (() => {
    if (!isBrandDetail) return null;
    const parts = pathname.split('/').filter(Boolean);
    // app / brands / :brandId / ...
    return parts.length >= 3 ? parts[2] : null;
  })();
  const hideBrandTrail =
    isContentWorkspace ||
    isRequestsWorkspace ||
    isDeliverablesWorkspace ||
    isTasksWorkspace ||
    isBrandsList ||
    isBrandDetail ||
    isCampaignsWorkspace;
  const hideShellCreate =
    isContentWorkspace ||
    isRequestsWorkspace ||
    isDeliverablesWorkspace ||
    isTasksWorkspace ||
    isCampaignsWorkspace ||
    isBrandsList;
  const hideMobileNav =
    isRequestsWorkspace || isDeliverablesWorkspace || isTasksWorkspace;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [wsSettingsOpen, setWsSettingsOpen] = useState(false);

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
              <Link href="/app" className="oma-rail-logo-link" aria-label={t('app.name')}>
                <PlxLogo sub={collapsed ? null : 'AI'} compact={collapsed} />
              </Link>
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
            <WorkspaceRow collapsed={collapsed} onOpenSettings={() => setWsSettingsOpen(true)} />
          </div>
          <RailNav collapsed={collapsed} />
          <div className="oma-rail-footer">
            <NotificationsBell />
            <UserMenu />
          </div>
        </aside>

        <div className="oma-shell-column">
          <Button
            type="text"
            aria-label={t('shell.openNav')}
            onClick={() => setMobileOpen(true)}
            className="oma-mobile-nav-fab"
            data-testid="mobile-nav-trigger"
          >
            <ShellIcon name="menu" />
          </Button>
          <header
            className="oma-top"
            data-content-workspace={isContentWorkspace ? 'true' : 'false'}
          >
            <div className="oma-top-start">
              {/* Mobile nav trigger removed from all headers per product request */}
              <div className="oma-top-context">
                {hideBrandTrail ? null : <BrandContext />}
                <ShellBreadcrumb />
              </div>
            </div>
            {/* Planable Content: no center search — actions live on the right */}
            {isContentWorkspace || isDeliverablesWorkspace || isTasksWorkspace ? null : (
              <div className="oma-top-center">
                <CommandSearch compact />
              </div>
            )}
            {isContentWorkspace ? (
              <div className="oma-top-actions oma-top-actions--content" id="oma-content-top-actions" />
            ) : isRequestsWorkspace || isDeliverablesWorkspace || isTasksWorkspace || isCampaignsWorkspace || isBrandsList ? (
              <div
                className="oma-top-actions oma-top-actions--workspace"
                id="oma-workspace-top-actions"
              />
            ) : hideShellCreate ? null : isBrandsList ? (
              <div className="oma-top-actions">
                <OmaLinkButton href="/app/brands/new" type="primary" data-testid="shell-create-brand">
                  <ShellIcon name="plus" size={16} />
                  <span>{t('brand.list.create')}</span>
                </OmaLinkButton>
              </div>
            ) : isBrandDetail && brandIdFromPath ? (
              <div className="oma-top-actions">
                <OmaLinkButton
                  href={`/app/brands/${brandIdFromPath}/connect`}
                  type="primary"
                  data-testid="shell-connect-website"
                >
                  <span>{t('brand.detail.connectCta')}</span>
                </OmaLinkButton>
              </div>
            ) : (
              <div className="oma-top-actions">
                <OmaLinkButton href="/app/requests" type="primary" data-testid="shell-create">
                  <ShellIcon name="plus" size={16} />
                  <span>{t('shell.create')}</span>
                </OmaLinkButton>
              </div>
            )}
          </header>
          <main id="main" className="oma-container">
            {children}
          </main>
        </div>

        <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} label={t('nav.primary')} nav>
          <div className="oma-mobile-drawer-header">
            <PlxLogo sub="AI" />
            <Button
              type="text"
              aria-label={t('shell.closeNav')}
              onClick={() => setMobileOpen(false)}
              className="oma-rail-collapse"
            >
              ×
            </Button>
          </div>
          <div className="oma-rail-workspace">
            <WorkspaceRow
              collapsed={false}
              onOpenSettings={() => {
                setMobileOpen(false);
                setWsSettingsOpen(true);
              }}
            />
          </div>
          <div className="oma-mobile-drawer-nav" onClick={() => setMobileOpen(false)}>
            <RailNav collapsed={false} />
          </div>
          <div className="oma-rail-footer">
            <NotificationsBell />
            <UserMenu />
          </div>
        </Drawer>

        <WorkspaceSettingsPanel open={wsSettingsOpen} onClose={() => setWsSettingsOpen(false)} />
      </div>
    </ToastProvider>
  );
}
