'use client';
import { OmaLinkButton } from '../ui/oma-link-button';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BRAND_LOGO_EVENT } from '../../lib/active-brand';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';
import { StatusChip } from '../ui/status-chip';
import { BrandMark } from './workspace-card';

type BrandWorkspaceShellProps = {
  brandId: string;
  brandName: string;
  brandLogoUrl?: string | null;
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
  brandLogoUrl,
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
  const [logoUrl, setLogoUrl] = useState<string | null>(brandLogoUrl ?? null);
  useEffect(() => {
    setLogoUrl(brandLogoUrl ?? null);
  }, [brandLogoUrl]);
  useEffect(() => {
    let live = true;
    if (!brandLogoUrl) {
      api<{ data: { logo_url?: string | null } }>(`/api/v1/brands/${brandId}`)
        .then((res) => {
          if (live) setLogoUrl(res.data.logo_url ?? null);
        })
        .catch(() => undefined);
    }
    const onLogo = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; logo_url?: string | null }>).detail;
      if (detail?.id === brandId) setLogoUrl(detail.logo_url ?? null);
    };
    window.addEventListener(BRAND_LOGO_EVENT, onLogo);
    return () => {
      live = false;
      window.removeEventListener(BRAND_LOGO_EVENT, onLogo);
    };
  }, [brandId, brandLogoUrl]);
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
      href: `${base}/discovery`,
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
    {
      href: `${base}/settings`,
      label: t('brand.nav.settings'),
      match: (p: string) => p.includes('/settings'),
    },
  ];

  return (
    <div className="oma-plx-listening oma-plx-brand oma-brand-shell" data-testid="brand-workspace">
      <div className="oma-plx-listening__intro oma-plx-deliv__intro oma-plx-brand__intro">
        <div className="oma-plx-brand__identity">
          <BrandMark name={brandName} logoUrl={logoUrl} />
          <div className="oma-plx-brand__identity-copy">
            <h1 className="oma-plx-listening__title">{brandName}</h1>
            {websiteUrl ? <p className="oma-plx-deliv__subtitle oma-ltr">{websiteUrl}</p> : null}
            <div className="oma-plx-brand__chips">
              {brandStatus ? <StatusChip status={brandStatus} /> : null}
              {scanStatus ? <StatusChip status={scanStatus} /> : null}
              {profileStatus ? <StatusChip status={profileStatus} /> : null}
            </div>
          </div>
        </div>
        {nextStepHref && nextStepLabel && !nextStepHref.includes('/connect') ? (
          <OmaLinkButton
            href={nextStepHref}
            type="primary"
            className="oma-plx-brand__cta"
            data-testid="brand-next-step"
          >
            {nextStepLabel}
          </OmaLinkButton>
        ) : null}
      </div>

      {journey && journey.length > 0 ? (
        <ol className="oma-plx-brand-journey" aria-label={t('home.journeyTitle')}>
          {journey.map((step) => (
            <li key={step.id} data-state={step.state}>
              {step.label}
            </li>
          ))}
        </ol>
      ) : null}

      <section className="oma-plx-listening-panel oma-plx-brand-panel">
        <header className="oma-plx-deliv-panel__head oma-plx-brand-nav-head">
          <nav
            className="oma-plx-deliv-groups oma-plx-brand-nav oma-brand-nav"
            aria-label={t('brand.nav.label')}
          >
            {links.map((link) => {
              const active = link.match(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  role="tab"
                  aria-current={active ? 'page' : undefined}
                  className={`oma-plx-deliv-groups__btn oma-brand-nav-link${active ? ' is-active' : ''}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="oma-plx-deliv-panel__body oma-plx-brand-panel__body">
          <div
            className={
              aside
                ? 'oma-plx-brand-layout oma-brand-body'
                : 'oma-plx-brand-layout oma-plx-brand-layout--single oma-brand-body oma-brand-body--single'
            }
          >
            <div className="oma-plx-brand-main oma-brand-main">{children}</div>
            {aside ? <aside className="oma-plx-brand-aside oma-brand-aside">{aside}</aside> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
