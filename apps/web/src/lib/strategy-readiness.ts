import { useCallback, useEffect, useState } from 'react';
import {
  checkFoundation,
  strategyJourney,
  type StrategyBlockingItem,
  type StrategyJourney,
  type StrategyJourneyStepId,
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

type VersionForJourney = {
  status: string;
  foundation?: Record<string, unknown> | null;
  organic_enabled?: boolean;
  paid_enabled?: boolean;
  organic?: Record<string, unknown> | null;
  paid?: Record<string, unknown> | null;
};

function hasAny(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (value && typeof value === 'object') return Object.values(value).some(hasAny);
  return typeof value === 'number' && value > 0;
}

/**
 * Same five steps as `GET …/readiness`, computed from the version detail the page
 * already has. Used when the readiness endpoint is unavailable (e.g. an API
 * deploy that lags the web deploy) so the guided strip never silently vanishes.
 */
export function fallbackStrategyJourney(
  version: VersionForJourney,
  executionStarted = false,
): StrategyJourney {
  const planHasContent =
    (Boolean(version.organic_enabled) && hasAny(version.organic)) ||
    (Boolean(version.paid_enabled) && hasAny(version.paid));
  return strategyJourney({
    versionStatus: version.status,
    foundation: checkFoundation(version.foundation ?? {}),
    planHasContent,
    executionStarted,
  });
}
