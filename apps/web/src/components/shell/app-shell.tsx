import Link from 'next/link';
import { TenantSwitcher } from './tenant-switcher';
import { LogoutButton } from './logout-button';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="oma-shell">
      <aside className="oma-rail" aria-label="Primary">
        <div style={{ fontWeight: 700, marginBottom: '1rem' }}>OMA AI</div>
        <p className="oma-muted" style={{ fontSize: 12 }}>
          OMA AI by IMKAN
        </p>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li>
              <Link href="/app">Home</Link>
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
