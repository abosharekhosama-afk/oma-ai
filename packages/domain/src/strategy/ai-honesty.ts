import type { StrategyAiAvailability } from './states';

export const AI_HONESTY_CODES = ['AI_NOT_CONFIGURED', 'AI_UNAVAILABLE', 'AI_REFUSED'] as const;
export type AiHonestyCode = (typeof AI_HONESTY_CODES)[number];

export function aiAvailabilityToErrorCode(
  availability: StrategyAiAvailability,
): AiHonestyCode {
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

/** DEC-016: never fabricate proposals when AI is not live. */
export function mustRefuseAiPropose(_availability?: StrategyAiAvailability): true {
  return true;
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
