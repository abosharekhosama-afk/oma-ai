import type { InfoState } from './states';

const ALLOWED_INFO_TRANSITIONS: Record<InfoState, InfoState[]> = {
  OBSERVED: ['USER_CONFIRMED', 'USER_CORRECTED', 'AI_INFERRED', 'STALE'],
  AI_INFERRED: ['USER_CONFIRMED', 'USER_CORRECTED', 'STALE'],
  USER_CONFIRMED: ['USER_CORRECTED', 'STALE'],
  USER_CORRECTED: ['STALE'],
  STALE: ['OBSERVED', 'AI_INFERRED', 'USER_CORRECTED'],
};

export function canTransitionInfoState(from: InfoState, to: InfoState): boolean {
  if (from === to) return true;
  return ALLOWED_INFO_TRANSITIONS[from]?.includes(to) ?? false;
}

export function infoStateAfterAccept(current: InfoState): InfoState {
  if (current === 'AI_INFERRED' || current === 'OBSERVED') return 'USER_CONFIRMED';
  return current;
}
