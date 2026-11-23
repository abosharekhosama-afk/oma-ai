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
    <nav
      className="oma-ws-tabs oma-brand-section-nav"
      data-testid={testId}
      aria-label={ariaLabel}
      role="tablist"
    >
      <Link
        href={backHref}
        className="oma-ws-tab oma-brand-nav-back--tab"
        aria-label={label}
        data-testid="brand-nav-back"
      >
        <ArrowLeftOutlined width={14} height={14} aria-hidden />
        <span className="oma-brand-nav-back__label">{label}</span>
      </Link>
      {children}
    </nav>
  );
}

export function BrandBackLink({ href, label }: { href: string; label: string }) {
  return (
    <nav className="oma-ws-tabs oma-brand-back-only" data-testid="brand-back-only" role="tablist">
      <Link href={href} className="oma-ws-tab oma-brand-nav-back--tab" aria-label={label}>
        <ArrowLeftOutlined width={14} height={14} aria-hidden />
        <span className="oma-brand-nav-back__label">{label}</span>
      </Link>
    </nav>
  );
}
