'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { OmaDotsLoader } from '../ui/oma-dots-loader';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ tenant_id: string }>;
  membership_route?: 'ONBOARDING' | 'AUTO_ACTIVATE' | 'SELECT_COMPANY' | 'PROCEED';
};

/**
 * Server returns membership_route from /auth/me after DEC-015 reconciliation.
 * Company creation uses Planable select-company (not legacy /app/onboarding).
 * Auth failures still open the new UI so the demo is not blocked on OMA login.
 */
export function MembershipRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const onOnboarding = pathname.startsWith('/app/onboarding');
    const onSelect = pathname.startsWith('/app/select-company');

    api<Me>('/api/v1/auth/me')
      .then((me) => {
        if (cancelled) return;
        const route = me.membership_route;

        // Legacy onboarding chrome is retired — always use Planable select-company.
        if (onOnboarding) {
          router.replace('/app/select-company');
          return;
        }

        if (
          (route === 'ONBOARDING' || route === 'SELECT_COMPANY') &&
          !onSelect &&
          !me.active_tenant_id
        ) {
          router.replace('/app/select-company');
          return;
        }

        if (
          (route === 'PROCEED' || route === 'AUTO_ACTIVATE' || me.active_tenant_id) &&
          onSelect
        ) {
          router.replace('/app');
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        // Demo path: do not bounce to OMA login — open new workspace UI.
        if (onOnboarding) {
          router.replace('/app/select-company');
          return;
        }
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="oma-route-loading" role="status" aria-label="Loading">
        <OmaDotsLoader />
      </div>
    );
  }
  return children;
}
