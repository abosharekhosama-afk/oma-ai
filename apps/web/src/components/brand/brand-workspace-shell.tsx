'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../../lib/use-locale';
import { StatusChip } from '../ui/status-chip';

type BrandWorkspaceShellProps = {
  brandId: string;
  brandName: string;
  brandStatus?: string | null;
  websiteUrl?: string | null;
  scanStatus?: string | null;
  profileStatus?: string | null;
  latestScanId?: string | null;
  nextStepHref?: string;
  nextStepLabel?: string;
  journey?: Array<{ id: string; label: string; state: 'done' | 'current' | 'todo' }>;
  children: React.ReactNode;
  aside?: React.ReactNode;
};

export function BrandWorkspaceShell({
  brandId,
  brandName,
  brandStatus,
  websiteUrl,
  scanStatus,
  profileStatus,
  latestScanId,
  nextStepHref,
  nextStepLabel,
  journey,
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
          <p className="oma-kicker">
            <Link href="/app/brands">{t('brand.list.title')}</Link>
            <span aria-hidden="true"> / </span>
            <span>{t('brand.workspace.context')}</span>
          </p>
          <h1>{brandName}</h1>
          {websiteUrl ? (
            <p className="oma-muted oma-ltr" style={{ margin: '0.25rem 0 0' }}>
              {websiteUrl}
            </p>
          ) : null}
          <div className="oma-chip-row">
            {brandStatus ? <StatusChip status={brandStatus} /> : null}
            {scanStatus ? <StatusChip status={scanStatus} /> : null}
            {profileStatus ? <StatusChip status={profileStatus} /> : null}
          </div>
          {journey && journey.length > 0 ? (
            <ol className="oma-journey-compact" aria-label={t('home.journeyTitle')}>
              {journey.map((step) => (
                <li key={step.id} data-state={step.state}>
                  {step.label}
                </li>
              ))}
            </ol>
          ) : null}
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
      <div className={aside ? 'oma-brand-body' : 'oma-brand-body oma-brand-body--single'}>
        <div className="oma-brand-main">{children}</div>
        {aside ? <aside className="oma-brand-aside">{aside}</aside> : null}
      </div>
    </div>
  );
}
