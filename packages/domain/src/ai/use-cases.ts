/** Text-only use cases. No image, video, audio, realtime, or tool calling. */

export const LUNA_USE_CASES = [
  'classification',
  'extraction_normalization',
  'summary',
  'translation',
  'rewrite',
  'missing_fields',
  'routine_suggestion',
] as const;

export const TERRA_USE_CASES = [
  'brand_profile_synthesis',
  'profile_comparison',
  'evidence_summary',
  'contradiction_analysis',
  'strategy_foundation',
  'organic_strategy',
  'paid_planning',
  'strategy_comparison',
  'campaign_brief',
  'content_brief',
  'audience_goals_kpis',
] as const;

export type LunaUseCase = (typeof LUNA_USE_CASES)[number];
export type TerraUseCase = (typeof TERRA_USE_CASES)[number];
export type AiUseCase = LunaUseCase | TerraUseCase;

export const AI_USE_CASES: readonly AiUseCase[] = [...LUNA_USE_CASES, ...TERRA_USE_CASES];

export function isAiUseCase(value: string): value is AiUseCase {
  return (AI_USE_CASES as readonly string[]).includes(value);
}
