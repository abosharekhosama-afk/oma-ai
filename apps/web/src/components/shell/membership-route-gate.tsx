'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ tenant_id: string }>;
  membership_route?: 'ONBOARDING' | 'AUTO_ACTIVATE' | 'SELECT_COMPANY' | 'PROCEED';
};

/**
 * Server returns membership_route from /auth/me after DEC-015 reconciliation.
 * Keep product routes from flashing when the account still needs onboarding.
 */
export function MembershipRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Me>('/api/v1/auth/me')
      .then((me) => {
        if (cancelled) return;
        const route = me.membership_route;
        const onOnboarding = pathname.startsWith('/app/onboarding');
        const onSelect = pathname.startsWith('/app/select-company');

        if (route === 'ONBOARDING' && !onOnboarding) {
          router.replace('/app/onboarding');
          return;
        }
        if (route === 'SELECT_COMPANY' && !onSelect && !me.active_tenant_id) {
          router.replace('/app/select-company');
          return;
        }
        if (
          (route === 'PROCEED' || route === 'AUTO_ACTIVATE' || me.active_tenant_id) &&
          (onOnboarding || onSelect)
        ) {
          router.replace('/app');
          return;
        }
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (error) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        <p>
          <Link href="/login">Sign in</Link>
        </p>
      </div>
    );
  }
  if (!ready) {
    return <p role="status">Loading…</p>;
  }
  return children;
}
