'use client';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { OmaLinkButton } from '../ui/oma-link-button';
import { usePathname } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Drawer } from '../ui/drawer';
import { ToastProvider } from '../ui/toast';
import { useT } from '../../lib/use-locale';
import dynamic from 'next/dynamic';
import { SessionInvalidOverlay } from './session-invalid';
import { SessionKeeper } from './session-keeper';
import { OfflineBanner } from '../ui/offline-banner';
import { OPEN_SETTINGS_EVENT } from '../../lib/settings-dialog';
import { openTeamInvite } from '../../lib/team-invite';
import { isSettingsSection } from '../settings/settings-sections';

// Heavy, on-demand UI is code-split out of the shell bundle.
const CommandSearch = dynamic(() => import('./command-search').then((m) => m.CommandSearch), {
  ssr: false,
});
import { NavLink } from './nav-link';
import { NotificationsBell } from './notifications-bell';
import {
  SHELL_NAV_MORE_PREF_KEY,
  SHELL_NAV_SECTIONS,
  SHELL_RAIL_PREF_KEY,
  sectionContainsPath,
} from './nav-config';
import { BrandPagesNav } from './brand-pages-nav';
import { ShellIcon } from './shell-icons';
import { UserMenu } from './user-menu';
import { WorkspaceRow } from './workspace-row';
import { WorkspacePathMenu } from './workspace-path-menu';
const SettingsPanel = dynamic(
  () => import('../settings/settings-panel').then((m) => m.SettingsPanel),
  { ssr: false },
);
const WorkspaceSettingsPanel = dynamic(
  () => import('./workspace-settings-panel').then((m) => m.WorkspaceSettingsPanel),
  { ssr: false },
);
import { PlxLogo } from '../ui/plx-icons';

function RailNav({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  const pathname = usePathname() || '/app';
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(SHELL_NAV_MORE_PREF_KEY) === '1';
    const inMore = SHELL_NAV_SECTIONS.some(
      (s) => s.collapsible && sectionContainsPath(s, pathname),
    );
    setMoreOpen(stored || inMore);
  }, [pathname]);
  const toggleMore = () =>
    setMoreOpen((open) => {
      window.localStorage.setItem(SHELL_NAV_MORE_PREF_KEY, open ? '0' : '1');
      return !open;
    });

  const list = (section: (typeof SHELL_NAV_SECTIONS)[number]) => (
    <ul
      className="oma-nav-list"
      id={`nav-list-${section.id}`}
      aria-label={section.hideLabel ? t(section.labelKey) : undefined}
      aria-labelledby={section.hideLabel ? undefined : `nav-${section.id}`}
    >
      {section.items.map((item) => (
        <li key={item.href}>
          <NavLink
            href={item.href}
            label={t(item.labelKey)}
            icon={item.icon}
            collapsed={collapsed}
          />
          {item.children && !collapsed && pathname.startsWith(item.href) ? (
            <ul className="oma-nav-sublist">
              {item.children.map((c) => (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    className="oma-nav-sublink"
                    data-active={pathname === c.href ? 'true' : undefined}
                    aria-current={pathname === c.href ? 'page' : undefined}
                  >
                    {t(c.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );

  const main = SHELL_NAV_SECTIONS.filter((s) => !s.collapsible);
  const more = SHELL_NAV_SECTIONS.filter((s) => s.collapsible);
  return (
    <nav className="oma-nav" aria-label={t('nav.primary')}>
      {main.map((section) => (
        <div key={section.id} className="oma-nav-group">
          {list(section)}
        </div>
      ))}
      <Suspense fallback={null}>
        <BrandPagesNav collapsed={collapsed} />
      </Suspense>
      {more.map((section) => (
        <div key={section.id} className="oma-nav-group oma-nav-more">
          <button
            type="button"
            className="oma-nav-more__toggle"
            id={`nav-${section.id}`}
            aria-expanded={moreOpen || collapsed}
            aria-controls={`nav-list-${section.id}`}
            onClick={toggleMore}
          >
            <span className="oma-nav-heading">{t(section.labelKey)}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="oma-nav-more__chev"
            >
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          {moreOpen || collapsed ? list(section) : null}
        </div>
      ))}
    </nav>
  );
}

function ShellBreadcrumb({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useT();
  const pathname = usePathname() || '/app';
  const isContent = pathname === '/app/content' || pathname.startsWith('/app/content/');
  const isDeliverables =
    pathname === '/app/deliverables' || pathname.startsWith('/app/deliverables/');
  const isTasks = pathname === '/app/tasks' || pathname.startsWith('/app/tasks/');
  const isRequests = pathname === '/app/requests' || pathname.startsWith('/app/requests/');
  const isCampaigns = pathname === '/app/campaigns' || pathname.startsWith('/app/campaigns/');

  /* Planable trail: Workspace / Section [/ View] — no brand switcher */
  if (isContent || isDeliverables || isTasks || isRequests || isCampaigns) {
    const sectionHref = isContent
      ? '/app/content'
      : isDeliverables
        ? '/app/deliverables'
        : isTasks
          ? '/app/tasks'
          : isRequests
            ? '/app/requests'
            : '/app/campaigns';
    const sectionLabel = isContent
      ? t('nav.content') || 'Content'
      : isDeliverables
        ? t('nav.deliverables') || t('demo.deliverables.title') || 'Deliverables'
        : isTasks
          ? t('nav.tasks') || t('demo.tasks.title') || 'Tasks'
          : isRequests
            ? t('nav.requests') || t('demo.requests.title') || 'Requests'
            : t('nav.campaigns') || t('demo.campaigns.title') || 'Campaigns';
    const defaultView = isContent ? 'Calendar' : isDeliverables ? 'Grid' : isTasks ? 'Board' : '';
    const showViewSlot = isContent || isDeliverables || isTasks;
    return (
      <nav
        aria-label={t('shell.breadcrumb')}
        className="oma-context-trail oma-context-trail--content"
      >
        <ol className="oma-breadcrumb oma-breadcrumb--planable">
          <li className="oma-breadcrumb-ws-wrap">
            <WorkspacePathMenu onOpenSettings={onOpenSettings} />
          </li>
          <li>
            <span className="oma-breadcrumb-sep" aria-hidden>
              /
            </span>
            <Link href={sectionHref}>{sectionLabel}</Link>
          </li>
          {showViewSlot ? (
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
          ) : null}
          {isCampaigns ? (
            <li className="oma-breadcrumb-campaign-tabs-wrap">
              <span className="oma-breadcrumb-sep" aria-hidden>
                /
              </span>
              <span
                className="oma-campaign-tabs-slot"
                id="oma-campaign-tabs-slot"
                data-testid="shell-campaign-tabs-slot"
              />
            </li>
          ) : null}
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
    // Never show a raw record id in the trail.
    else if (segments[idx - 1] === 'brands') label = t('shell.breadcrumbBrand');
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
  // Home owns its single primary "Create post" action.
  const hideShellCreate =
    pathname === '/app' ||
    isContentWorkspace ||
    isRequestsWorkspace ||
    isDeliverablesWorkspace ||
    isTasksWorkspace ||
    isCampaignsWorkspace ||
    isBrandsList;
  const [collapsed, setCollapsed] = useState(false);
  // Only animate the rail after a user toggle (never on first paint / hydration).
  const [railAnimated, setRailAnimated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [wsSettingsOpen, setWsSettingsOpen] = useState(false);
  // Settings card (opened from the account menu, or `?settings=<section>` / the old /app/settings URL).
  const [settingsSection, setSettingsSection] = useState<string | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const section = (e as CustomEvent<{ section?: string }>).detail?.section;
      setMobileOpen(false);
      setSettingsSection(section || 'general');
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('settings');
    if (fromUrl) {
      setSettingsSection(fromUrl);
      url.searchParams.delete('settings');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
  }, []);

  // Close the mobile nav drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
    setRailAnimated(true);
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
        data-rail-anim={railAnimated ? 'true' : 'false'}
      >
        <aside
          className="oma-rail"
          aria-label={t('nav.primary')}
          data-collapsed={collapsed}
          data-testid="oma-rail"
        >
          <div className="oma-rail-header">
            <div className="oma-rail-brand">
              {collapsed ? (
                <button
                  type="button"
                  className="oma-rail-logo-link oma-rail-logo-link--expand"
                  aria-label={t('shell.expandNav')}
                  onClick={toggleCollapsed}
                  data-testid="oma-rail-logo-expand"
                >
                  <PlxLogo sub={null} compact />
                </button>
              ) : (
                <Link href="/app" className="oma-rail-logo-link" aria-label={t('app.name')}>
                  <PlxLogo sub="AI" compact={false} />
                </Link>
              )}
            </div>
            {!collapsed ? (
              <Button
                type="text"
                aria-label={t('shell.collapseNav')}
                aria-pressed={false}
                onClick={toggleCollapsed}
                className="oma-rail-collapse"
                data-testid="oma-rail-collapse"
              >
                <ShellIcon name="collapse" />
              </Button>
            ) : null}
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
              {/* Mobile (<768px): hamburger opens the off-canvas nav drawer. Hidden on desktop. */}
              <Button
                type="text"
                aria-label={t('shell.openNav')}
                aria-expanded={mobileOpen}
                aria-controls="oma-mobile-nav"
                onClick={() => setMobileOpen(true)}
                className="oma-mobile-nav-toggle"
                data-testid="mobile-nav-toggle"
              >
                <ShellIcon name="menu" />
              </Button>
              <div className="oma-top-context">
                {/* Brand switcher removed from header trail */}
                <ShellBreadcrumb onOpenSettings={() => setWsSettingsOpen(true)} />
              </div>
            </div>
            {/* Planable Content: no center search — actions live on the right */}
            {isContentWorkspace || isDeliverablesWorkspace || isTasksWorkspace ? null : (
              <div className="oma-top-center">
                <CommandSearch compact />
              </div>
            )}
            {isContentWorkspace ? (
              <div
                className="oma-top-actions oma-top-actions--content"
                id="oma-content-top-actions"
              />
            ) : isRequestsWorkspace ||
              isDeliverablesWorkspace ||
              isTasksWorkspace ||
              isCampaignsWorkspace ||
              isBrandsList ? (
              <div
                className="oma-top-actions oma-top-actions--workspace"
                id="oma-workspace-top-actions"
              />
            ) : hideShellCreate ? null : isBrandsList ? (
              <div className="oma-top-actions">
                <OmaLinkButton
                  href="/app/brands/new"
                  type="primary"
                  data-testid="shell-create-brand"
                >
                  <ShellIcon name="plus" size={16} />
                  <span>{t('brand.list.create')}</span>
                </OmaLinkButton>
              </div>
            ) : pathname === '/app/team' ? (
              <div className="oma-top-actions">
                <Button type="primary" data-testid="shell-invite-members" onClick={openTeamInvite}>
                  <ShellIcon name="plus" size={16} />
                  <span>{t('team.invite_members')}</span>
                </Button>
              </div>
            ) : isBrandDetail && brandIdFromPath && !pathname.endsWith('/settings') ? (
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
            <OfflineBanner />
            {children}
          </main>
        </div>

        <Drawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          label={t('nav.primary')}
          nav
          id="oma-mobile-nav"
        >
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

        {settingsSection ? (
          <SettingsPanel
            initialSection={isSettingsSection(settingsSection) ? settingsSection : 'general'}
            onClose={() => setSettingsSection(null)}
          />
        ) : null}
        {wsSettingsOpen ? (
          <WorkspaceSettingsPanel open={wsSettingsOpen} onClose={() => setWsSettingsOpen(false)} />
        ) : null}
        <SessionKeeper />
        <SessionInvalidOverlay />
      </div>
    </ToastProvider>
  );
}
