'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../../lib/use-locale';
import { StatusChip } from '../ui/status-chip';

type BrandWorkspaceShellProps = {
  brandId: string;
  brandName: string;
  brandStatus?: string | null;
  scanStatus?: string | null;
  profileStatus?: string | null;
  latestScanId?: string | null;
  nextStepHref?: string;
  nextStepLabel?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
};

export function BrandWorkspaceShell({
  brandId,
  brandName,
  brandStatus,
  scanStatus,
  profileStatus,
  latestScanId,
  nextStepHref,
  nextStepLabel,
  children,
  aside,
}: BrandWorkspaceShellProps) {
  const t = useT();
  const pathname = usePathname();
  const base = `/app/brands/${brandId}`;
  const scanHref = latestScanId ? `${base}/scans/${latestScanId}` : `${base}/scans/new`;
  const links = [
    { href: base, label: t('brand.nav.overview'), match: (p: string) => p === base },
    {
      href: `${base}/connect`,
      label: t('brand.nav.website'),
      match: (p: string) => p.includes('/connect'),
    },
    {
      href: scanHref,
      label: t('brand.nav.scan'),
      match: (p: string) => p.includes('/scans'),
    },
    {
      href: `${base}/discovery/pages`,
      label: t('brand.nav.discovery'),
      match: (p: string) => p.includes('/discovery'),
    },
    {
      href: `${base}/profiles`,
      label: t('brand.nav.intelligence'),
      match: (p: string) => p.includes('/profiles'),
    },
    {
      href: `${base}/strategies`,
      label: t('brand.nav.strategies'),
      match: (p: string) => p.includes('/strategies'),
    },
  ];

  return (
    <div className="oma-brand-shell" data-testid="brand-workspace">
      <header className="oma-brand-header">
        <div>
          <p className="oma-muted" style={{ margin: 0, fontSize: 12 }}>
            <Link href="/app/brands">{t('brand.list.title')}</Link>
            <span aria-hidden="true"> / </span>
            <span>{t('brand.workspace.context')}</span>
          </p>
          <h1 style={{ margin: '0.25rem 0 0' }}>{brandName}</h1>
          <div className="oma-chip-row">
            {brandStatus ? <StatusChip status={brandStatus} /> : null}
            {scanStatus ? <StatusChip status={scanStatus} /> : null}
            {profileStatus ? <StatusChip status={profileStatus} /> : null}
          </div>
        </div>
        {nextStepHref && nextStepLabel ? (
          <Link href={nextStepHref} className="oma-btn">
            {nextStepLabel}
          </Link>
        ) : null}
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
