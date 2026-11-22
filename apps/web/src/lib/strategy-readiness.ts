import { useCallback, useEffect, useState } from 'react';
import type {
  StrategyBlockingItem,
  StrategyJourney,
  StrategyJourneyStepId,
} from '@oma/domain/browser';
import { api } from './api';

/** Mirrors `GET …/strategies/:strategyId/versions/:versionId/readiness`. */
export type StrategyReadiness = {
  version_id: string;
  status: string;
  action: 'submit' | 'approve' | null;
  eligible: boolean;
  blocking_reasons: StrategyBlockingItem[];
  journey: StrategyJourney;
};

export function strategyBase(brandId: string, strategyId: string) {
  return `/app/brands/${brandId}/strategies/${strategyId}`;
}

/** Where the single primary action of each guided step takes the user. */
export function journeyActionHref(
  brandId: string,
  strategyId: string,
  step: StrategyJourneyStepId,
): string {
  const base = strategyBase(brandId, strategyId);
  switch (step) {
    case 'foundation':
      return `${base}/edit`;
    case 'plan':
      return `${base}#strategy-ai-assistant`;
    case 'submit':
    case 'approve':
      return `${base}/review`;
    case 'execute':
      return `${base}/execution`;
  }
}

/** Keep only well-formed blocking items from a 422 `details` array. */
export function blockingItemsFromDetails(details: unknown[] | undefined): StrategyBlockingItem[] {
  if (!details) return [];
  return details.filter(
    (d): d is StrategyBlockingItem =>
      Boolean(d) &&
      typeof d === 'object' &&
      typeof (d as { code?: unknown }).code === 'string' &&
      typeof (d as { fix_path?: unknown }).fix_path === 'string',
  );
}

export function useStrategyReadiness(
  brandId: string,
  strategyId: string,
  versionId: string | null | undefined,
  refreshKey: unknown = 0,
) {
  const [readiness, setReadiness] = useState<StrategyReadiness | null>(null);
  const reload = useCallback(async () => {
    if (!versionId) {
      setReadiness(null);
      return;
    }
    try {
      const res = await api<{ data: StrategyReadiness }>(
        `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/readiness`,
      );
      setReadiness(res.data);
    } catch {
      // Guidance is best-effort; the page still works without it.
      setReadiness(null);
    }
  }, [brandId, strategyId, versionId]);
  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);
  return { readiness, reload };
}
