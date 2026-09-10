'use client';
export function StrategyStatusBadge({ status }: { status: string }) {
  return (
    <span className="oma-badge" aria-label={`Status ${status}`} data-status={status}>
      {status}
    </span>
  );
}
