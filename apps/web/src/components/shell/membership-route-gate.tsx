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
 * Ready is always set after the check (or on timeout) so the dots loader never sticks.
 * Auth failures still open the workspace UI for the demo product.
 */
export function MembershipRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const onOnboarding = pathname.startsWith('/app/onboarding');
    const onSelect = pathname.startsWith('/app/select-company');

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    const timeoutId = window.setTimeout(finish, 800);

    api<Me>('/api/v1/auth/me')
      .then((me) => {
        if (cancelled) return;
        const route = me.membership_route;

        if (onOnboarding) {
          finish();
          router.replace('/app/select-company');
          return;
        }

        if (
          (route === 'ONBOARDING' || route === 'SELECT_COMPANY') &&
          !onSelect &&
          !me.active_tenant_id
        ) {
          finish();
          router.replace('/app/select-company');
          return;
        }

        if (
          (route === 'PROCEED' || route === 'AUTO_ACTIVATE' || me.active_tenant_id) &&
          onSelect
        ) {
          finish();
          router.replace('/app');
          return;
        }
        finish();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          window.location.replace('/login?reason=session');
          return;
        }
        if (onOnboarding) {
          finish();
          router.replace('/app/select-company');
          return;
        }
        finish();
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
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
