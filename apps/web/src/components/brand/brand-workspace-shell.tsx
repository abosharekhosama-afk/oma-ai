'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../../lib/use-locale';

type BrandWorkspaceShellProps = {
  brandId: string;
  brandName: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
};

export function BrandWorkspaceShell({
  brandId,
  brandName,
  children,
  aside,
}: BrandWorkspaceShellProps) {
  const t = useT();
  const pathname = usePathname();
  const base = `/app/brands/${brandId}`;
  const links = [
    { href: base, label: t('brand.nav.overview'), match: (p: string) => p === base },
    {
      href: `${base}/connect`,
      label: t('brand.nav.website'),
      match: (p: string) => p.includes('/connect'),
    },
    {
      href: `${base}/scans/new`,
      label: t('brand.nav.scan'),
      match: (p: string) => p.includes('/scans'),
    },
    {
      href: `${base}/discovery/pages`,
      label: t('brand.nav.discovery'),
      match: (p: string) => p.includes('/discovery'),
    },
  ];

  return (
    <div className="oma-brand-shell">
      <header className="oma-brand-header">
        <div>
          <p className="oma-muted" style={{ margin: 0, fontSize: 12 }}>
            <Link href="/app/brands">{t('brand.list.title')}</Link>
          </p>
          <h1 style={{ margin: '0.25rem 0 0' }}>{brandName}</h1>
        </div>
      </header>
      <nav className="oma-brand-nav" aria-label={t('brand.nav.label')}>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={link.match(pathname) ? 'page' : undefined}
                className={link.match(pathname) ? 'oma-brand-nav-active' : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="oma-brand-body">
        <div className="oma-brand-main">{children}</div>
        {aside ? <aside className="oma-brand-aside">{aside}</aside> : null}
      </div>
    </div>
  );
}
