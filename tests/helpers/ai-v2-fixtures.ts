import { AI_PROPOSAL_BANNER } from '@oma/domain';

export type V2Variant = {
  text: string;
  rationale?: string;
  factual?: boolean;
  groundingRefs?: string[];
};

/** A v2 (Phase 3) content/inbox model reply as the provider would send it. */
export function v2Reply(input: {
  variants: V2Variant[];
  promptId?: string;
  language?: 'en' | 'ar';
  sourceVersion?: string;
  hashtags?: string[];
}): string {
  return JSON.stringify({
    promptId: input.promptId ?? 'oma.caption_generation',
    promptVersion: '2',
    schemaVersion: '2',
    language: input.language ?? 'en',
    sourceVersion: input.sourceVersion ?? 'none',
    banner: AI_PROPOSAL_BANNER,
    variants: input.variants.map((v) => ({
      text: v.text,
      rationale: v.rationale ?? '',
      factual: v.factual ?? false,
      groundingRefs: v.groundingRefs ?? [],
    })),
    hashtags: input.hashtags ?? [],
    warnings: [],
  });
}
