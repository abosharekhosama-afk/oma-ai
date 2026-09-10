'use client';
import Link from 'next/link';
export function TrackTabs({ brandId, strategyId }: { brandId: string; strategyId: string }) {
  const base = `/app/brands/${brandId}/strategies/${strategyId}`;
  return (
    <nav aria-label="Tracks" data-testid="strategy-track-tabs">
      <Link href={`${base}/organic`}>Organic</Link>
      <Link href={`${base}/paid`}>Paid</Link>
    </nav>
  );
}
