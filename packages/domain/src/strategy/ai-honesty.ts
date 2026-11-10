import type { StrategyAiAvailability } from './states';
import { isAiAnalysisAvailable } from '../ai/availability';

export const AI_HONESTY_CODES = ['AI_NOT_CONFIGURED', 'AI_UNAVAILABLE', 'AI_REFUSED'] as const;
export type AiHonestyCode = (typeof AI_HONESTY_CODES)[number];

export const STRATEGY_AI_MODES = ['live', 'refuse', 'not_configured'] as const;
export type StrategyAiMode = (typeof STRATEGY_AI_MODES)[number];

export function strategyAiMode(env: { STRATEGY_AI_MODE?: string } = process.env): StrategyAiMode {
  const raw = env.STRATEGY_AI_MODE;
  if (raw === 'refuse' || raw === 'not_configured' || raw === 'live') return raw;
  return 'live';
}

export function aiAvailabilityToErrorCode(availability: StrategyAiAvailability): AiHonestyCode {
  switch (availability) {
    case 'UNAVAILABLE':
      return 'AI_UNAVAILABLE';
    case 'REFUSED':
      return 'AI_REFUSED';
    case 'NOT_CONFIGURED':
    default:
      return 'AI_NOT_CONFIGURED';
  }
}

export function mustRefuseAiPropose(
  _availability?: StrategyAiAvailability,
  options?: { mode?: StrategyAiMode; aiAvailable?: boolean },
): boolean {
  const mode = options?.mode ?? strategyAiMode();
  if (mode === 'refuse' || mode === 'not_configured') return true;
  if (options?.aiAvailable === false) return true;
  if (options?.aiAvailable === true) return false;
  return !isAiAnalysisAvailable();
}

export function aiProposeHonestyMessage(code: AiHonestyCode): string {
  switch (code) {
    case 'AI_UNAVAILABLE':
      return 'AI assistance is temporarily unavailable. Continue manually.';
    case 'AI_REFUSED':
      return 'AI assistance refused this request. Continue manually.';
    case 'AI_NOT_CONFIGURED':
    default:
      return 'AI assistance is not configured. Continue with the manual strategy journey.';
  }
}
