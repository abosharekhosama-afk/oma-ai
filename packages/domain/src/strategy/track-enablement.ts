import { canPatchVersionContent } from './immutability';
import type { StrategyVersionStatus } from './states';

export type TrackEnablementInput = {
  status: StrategyVersionStatus;
  organicEnabled: boolean;
  paidEnabled: boolean;
  organicDisabledRationale?: string | null;
  paidDisabledRationale?: string | null;
};

export type TrackEnablementResult = {
  ok: boolean;
  blockingReasons: string[];
};

export function canToggleTracks(status: StrategyVersionStatus): boolean {
  return canPatchVersionContent(status);
}

export function validateTrackEnablementForSubmit(
  input: Omit<TrackEnablementInput, 'status'> & { status?: StrategyVersionStatus },
): TrackEnablementResult {
  const blockingReasons: string[] = [];
  if (!input.organicEnabled && !input.paidEnabled) {
    blockingReasons.push('NO_TRACK_ENABLED');
  }
  if (!input.organicEnabled && !input.organicDisabledRationale?.trim()) {
    blockingReasons.push('ORGANIC_DISABLED_RATIONALE_REQUIRED');
  }
  if (!input.paidEnabled && !input.paidDisabledRationale?.trim()) {
    blockingReasons.push('PAID_DISABLED_RATIONALE_REQUIRED');
  }
  return { ok: blockingReasons.length === 0, blockingReasons };
}
