'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { BrandNavLink } from '../../lib/brand-workspace-nav';
import { useT } from '../../lib/use-locale';
import { BrandSectionNav } from './brand-section-nav';

type Props = {
  links: BrandNavLink[];
  ariaLabel: string;
  backHref: string;
  backLabel?: string;
};

export function BrandWorkspaceSubnav({ links, ariaLabel, backHref, backLabel }: Props) {
  const pathname = usePathname();
  const t = useT();
  return (
    <BrandSectionNav
      backHref={backHref}
      backLabel={backLabel}
      ariaLabel={ariaLabel}
      testId="brand-subnav"
    >
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.id}
            data-state={link.state}
            title={link.state ? t(`brand.journey.state.${link.state}`) : undefined}
            href={link.href}
            role="tab"
            aria-current={active ? 'page' : undefined}
            className={`oma-ws-tab oma-brand-nav-link oma-brand-nav-link--tab${
              active ? ' is-active' : ''
            }${link.state ? ` is-journey-${link.state}` : ''}`}
          >
            <span className="oma-brand-nav-link__label">{link.label}</span>
          </Link>
        );
      })}
    </BrandSectionNav>
  );
}
