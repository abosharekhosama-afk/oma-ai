import type { PlanWorkRequestDraft } from '../strategy/plan-work-requests';
import type { Track } from './states';

/** Strategy plan lines always get a calendar draft (publishing approval is still separate). */
export function shouldCreatePlanContentDraft(_draft: PlanWorkRequestDraft): boolean {
  return true;
}

export function planDraftTrack(draft: PlanWorkRequestDraft): Track {
  return draft.track === 'paid' ? 'PAID' : 'ORGANIC';
}
