'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '../../lib/use-locale';

export function TrackTabs({ brandId, strategyId }: { brandId: string; strategyId: string }) {
  const t = useT();
  const pathname = usePathname();
  const base = `/app/brands/${brandId}/strategies/${strategyId}`;
  const organicActive = pathname.includes('/organic');
  const paidActive = pathname.includes('/paid');
  return (
    <nav
      className="oma-strategy-tracks"
      aria-label={t('strategy.nav.label')}
      data-testid="strategy-track-tabs"
    >
      <Link
        href={`${base}/organic`}
        className={
          organicActive
            ? 'oma-track-pill oma-track-pill--organic'
            : 'oma-track-pill oma-track-pill--off'
        }
        aria-current={organicActive ? 'page' : undefined}
      >
        {t('strategy.nav.organic')}
      </Link>
      <Link
        href={`${base}/paid`}
        className={
          paidActive ? 'oma-track-pill oma-track-pill--paid' : 'oma-track-pill oma-track-pill--off'
        }
        aria-current={paidActive ? 'page' : undefined}
      >
        {t('strategy.nav.paid')}
      </Link>
    </nav>
  );
}
