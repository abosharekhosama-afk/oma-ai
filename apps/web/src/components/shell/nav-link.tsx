'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip } from '../ui/tooltip';
import type { NavIconId } from './nav-config';
import { ShellIcon } from './shell-icons';

export function NavLink({
  href,
  label,
  icon,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: NavIconId;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href);

  const link = (
    <Link
      href={href}
      className="oma-nav-link"
      data-active={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
    >
      <ShellIcon name={icon} className="oma-nav-link-icon" />
      <span className="oma-nav-link-label">{label}</span>
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip label={label}>
      <span className="oma-nav-tooltip-wrap">{link}</span>
    </Tooltip>
  );
}
