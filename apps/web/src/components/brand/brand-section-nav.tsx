'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useT } from '../../lib/use-locale';
import { ArrowLeftOutlined } from '../ui/lucide-icons';

type BrandSectionNavProps = {
  backHref: string;
  backLabel?: string;
  ariaLabel: string;
  children: ReactNode;
  testId?: string;
};

/** Single primary-style tab row with a back control (Planable / social-app pattern). */
export function BrandSectionNav({
  backHref,
  backLabel,
  ariaLabel,
  children,
  testId,
}: BrandSectionNavProps) {
  const t = useT();
  const label = backLabel ?? t('brand.nav.back');
  return (
    <div className="oma-brand-section-nav" data-testid={testId}>
      <Link
        href={backHref}
        className="oma-brand-nav-back"
        aria-label={label}
        data-testid="brand-nav-back"
      >
        <ArrowLeftOutlined width={18} height={18} aria-hidden />
        <span className="oma-brand-nav-back__label">{label}</span>
      </Link>
      <nav
        className="oma-plx-deliv-groups oma-plx-brand-nav oma-plx-brand-nav--primary oma-brand-nav"
        aria-label={ariaLabel}
      >
        {children}
      </nav>
    </div>
  );
}

export function BrandBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <div className="oma-brand-back-only" data-testid="brand-back-only">
      <Link href={href} className="oma-brand-nav-back" aria-label={label}>
        <ArrowLeftOutlined width={18} height={18} aria-hidden />
        <span className="oma-brand-nav-back__label">{label}</span>
      </Link>
    </div>
  );
}