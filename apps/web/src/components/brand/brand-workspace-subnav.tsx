'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { BrandNavLink } from '../../lib/brand-workspace-nav';

type Props = {
  links: BrandNavLink[];
  ariaLabel: string;
};

export function BrandWorkspaceSubnav({ links, ariaLabel }: Props) {
  const pathname = usePathname();
  return (
    <nav
      className="oma-plx-deliv-groups oma-plx-brand-subnav oma-brand-nav-secondary"
      aria-label={ariaLabel}
      data-testid="brand-subnav"
    >
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.id}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`oma-plx-deliv-groups__btn oma-brand-nav-link oma-brand-nav-link--secondary${
              active ? ' is-active' : ''
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
