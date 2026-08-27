import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { resolveLocale, t } from '@oma/i18n';
import { TenantSwitcher } from './tenant-switcher';
import { LogoutButton } from './logout-button';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get('oma_locale')?.value ?? hdrs.get('accept-language'));

  return (
    <div className="oma-shell">
      <aside className="oma-rail" aria-label="Primary">
        <div style={{ fontWeight: 700, marginBottom: '1rem' }}>{t(locale, 'app.name')}</div>
        <p className="oma-muted" style={{ fontSize: 12 }}>
          {t(locale, 'app.endorsement')}
        </p>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li>
              <Link href="/app">{t(locale, 'nav.home')}</Link>
            </li>
            <li>
              <Link href="/app/brands">{t(locale, 'nav.intelligence')}</Link>
            </li>
          </ul>
        </nav>
      </aside>
      <div>
        <header className="oma-top">
          <TenantSwitcher />
          <LogoutButton />
        </header>
        <main id="main" className="oma-container">
          {children}
        </main>
      </div>
    </div>
  );
}
