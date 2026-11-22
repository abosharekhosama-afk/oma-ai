'use client';
import { strategyDisplayStatus } from '@oma/domain/browser';
import { StatusChip } from '../ui/status-chip';
import { useT } from '../../lib/use-locale';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<string, Tone> = {
  CURRENT: 'info',
  APPROVED: 'success',
  IN_REVIEW: 'warning',
  CHANGES_REQUESTED: 'warning',
  DRAFT: 'neutral',
  ARCHIVED: 'neutral',
};

type StrategyLike = {
  status: string;
  is_current?: boolean;
  has_approved_version?: boolean;
  display_status?: string;
  latest_version_status?: string | null;
  latest_version?: { status: string } | null;
};

/** The one status a person sees for a strategy (draft / in review / approved / current / archived). */
export function strategyStatusOf(strategy: StrategyLike): string {
  return (
    strategy.display_status ??
    strategyDisplayStatus({
      strategyStatus: strategy.status,
      isCurrent: Boolean(strategy.is_current),
      hasApprovedVersion: Boolean(strategy.has_approved_version),
      latestVersionStatus: strategy.latest_version_status ?? strategy.latest_version?.status,
    })
  );
}

export function StrategyStatusBadge({ strategy }: { strategy: StrategyLike }) {
  const t = useT();
  const status = strategyStatusOf(strategy);
  return (
    <span
      data-testid={status === 'CURRENT' ? 'strategy-current-badge' : 'strategy-status-badge'}
      data-status={status}
    >
      <StatusChip tone={TONE[status] ?? 'neutral'} label={t(`strategy.status.${status}`)} />
    </span>
  );
}

/** Localized label for a strategy *version* status (APPROVED, SUPERSEDED, …). */
export function StrategyVersionStatusChip({ status }: { status: string }) {
  return (
    <span data-testid="strategy-version-status" data-status={status}>
      <StatusChip status={status} />
    </span>
  );
}
