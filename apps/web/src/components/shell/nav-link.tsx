'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className="oma-nav-link"
      data-active={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}
