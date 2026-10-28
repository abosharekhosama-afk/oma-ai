'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { PageSkeleton } from '../ui/page-skeleton';
import { screenShimmerFor } from '../ui/screen-shimmer';
import { loginUrlFor, SESSION_OK_KEY } from '../../lib/session';

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
  // Skip the blocking check when this tab already confirmed a session (no skeleton flash on nav).
  const [ready, setReady] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.sessionStorage.getItem(SESSION_OK_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    const onOnboarding = pathname.startsWith('/app/onboarding');
    const onSelect = pathname.startsWith('/app/select-company');

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    // Never reveal protected UI before the session is confirmed, except as a slow-network fallback.
    const timeoutId = window.setTimeout(finish, 6000);

    api<Me>('/api/v1/auth/me')
      .then((me) => {
        if (cancelled) return;
        try {
          window.sessionStorage.setItem(SESSION_OK_KEY, '1');
        } catch {
          /* ignore */
        }
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

        if ((route === 'PROCEED' || route === 'AUTO_ACTIVATE' || me.active_tenant_id) && onSelect) {
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
          try {
            window.sessionStorage.removeItem(SESSION_OK_KEY);
          } catch {
            /* ignore */
          }
          window.location.replace(loginUrlFor(window.location));
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
    // Screens with their own shimmer render it in the real page geometry (no extra inset), so
    // it continues seamlessly into the page's chunk/data shimmer — never two different skeletons.
    const screen = screenShimmerFor(pathname);
    return (
      <div
        className={screen ? 'oma-route-skeleton oma-route-skeleton--screen' : 'oma-route-skeleton'}
        data-testid="route-skeleton"
      >
        {screen ?? <PageSkeleton rows={6} />}
      </div>
    );
  }
  return children;
}
