import { cookies, headers } from 'next/headers';
import { resolveLocale, t } from '@oma/i18n';
import { TenantSwitcher } from './tenant-switcher';
import { LogoutButton } from './logout-button';
import { LanguageSwitcher } from './language-switcher';
import { NavLink } from './nav-link';
import { MembershipRouteGate } from './membership-route-gate';
import { NotificationsBell } from './notifications-bell';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get('oma_locale')?.value ?? hdrs.get('accept-language'));

  return (
    <div className="oma-shell">
      <aside className="oma-rail" aria-label={t(locale, 'nav.primary')}>
        <div className="oma-rail-brand">
          <span className="oma-rail-mark" aria-hidden="true">
            OMA
          </span>
          <span className="oma-rail-name">{t(locale, 'app.name')}</span>
        </div>
        <p className="oma-rail-endorsement">{t(locale, 'app.endorsement')}</p>
        <nav className="oma-nav">
          <p className="oma-nav-section" id="nav-workspace">
            {t(locale, 'nav.section.workspace')}
          </p>
          <ul className="oma-nav-list" aria-labelledby="nav-workspace">
            <li>
              <NavLink href="/app" label={t(locale, 'nav.home')} />
            </li>
            <li>
              <NavLink href="/app/brands" label={t(locale, 'nav.intelligence')} />
            </li>
            <li>
              <NavLink href="/app/campaigns" label={t(locale, 'nav.campaigns')} />
            </li>
            <li>
              <NavLink href="/app/content" label={t(locale, 'nav.content')} />
            </li>
            <li>
              <NavLink href="/app/requests" label={t(locale, 'nav.requests')} />
            </li>
            <li>
              <NavLink href="/app/tasks" label={t(locale, 'nav.tasks')} />
            </li>
            <li>
              <NavLink href="/app/deliverables" label={t(locale, 'nav.deliverables')} />
            </li>
            <li>
              <NavLink href="/app/reviews" label={t(locale, 'nav.reviews')} />
            </li>
            <li>
              <NavLink href="/app/schedule" label={t(locale, 'nav.schedule')} />
            </li>
            <li>
              <NavLink href="/app/analytics" label={t(locale, 'nav.analytics')} />
            </li>
            <li>
              <NavLink href="/app/team" label={t(locale, 'nav.team')} />
            </li>
            <li>
              <NavLink href="/app/activity" label={t(locale, 'nav.activity')} />
            </li>
            <li>
              <NavLink href="/app/settings" label={t(locale, 'nav.settings')} />
            </li>
            <li>
              <NavLink href="/app/company/members" label={t(locale, 'nav.company')} />
            </li>
          </ul>
        </nav>
      </aside>
      <div className="oma-shell-column">
        <header className="oma-top">
          <TenantSwitcher />
          <div className="oma-top-actions">
            <NotificationsBell />
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </header>
        <main id="main" className="oma-container">
          <MembershipRouteGate>{children}</MembershipRouteGate>
        </main>
      </div>
    </div>
  );
}
