import { AI_PROPOSAL_BANNER, type AiProposal } from './proposal';
import type { AiUseCase } from './use-cases';

export function testAdapterAllowed(env: {
  NODE_ENV?: string;
  AI_TEST_ADAPTER?: string;
  AI_LIVE_ENABLED?: string;
}): boolean {
  return (
    env.NODE_ENV !== 'production' && env.AI_TEST_ADAPTER === '1' && env.AI_LIVE_ENABLED !== 'true'
  );
}

/** Fixed proposals for certification. No network, no provider key, no live model. */
export function deterministicProposal(input: {
  useCase: AiUseCase;
  evidenceRefs: string[];
  sourceVersion: string;
  language?: 'en' | 'ar';
}): AiProposal {
  const language = input.language ?? 'en';
  const comparison =
    input.useCase === 'profile_comparison' || input.useCase === 'strategy_comparison';
  return {
    promptId: `test.${input.useCase}`,
    promptVersion: 'test-1',
    schemaVersion: '1',
    language,
    sourceVersion: input.sourceVersion,
    evidenceRefs: input.evidenceRefs,
    items: [
      {
        field: comparison ? 'difference' : 'recommendation',
        value: comparison
          ? `TEST_DIFF:${input.useCase}:${input.sourceVersion}`
          : `TEST_PROPOSAL:${input.useCase}`,
        kind: 'proposal',
        confidence: 0.4,
        evidenceRefs: input.evidenceRefs,
      },
      {
        field: 'evidence_note',
        value: input.evidenceRefs.join(',') || 'none',
        kind: 'fact',
        confidence: 1,
        evidenceRefs: input.evidenceRefs,
      },
      ...(input.useCase === 'brand_profile_synthesis'
        ? [
            {
              field: 'brand.description',
              value:
                language === 'ar'
                  ? 'وصف تجريبي للعلامة من الأدلة.'
                  : 'Test brand description grounded in scan evidence.',
              kind: 'proposal' as const,
              confidence: 0.55,
              evidenceRefs: input.evidenceRefs,
            },
            {
              field: 'brand.tone',
              value: language === 'ar' ? 'نبرة مهنية وواضحة.' : 'Professional and clear.',
              kind: 'inference' as const,
              confidence: 0.45,
              evidenceRefs: input.evidenceRefs,
            },
            {
              field: 'brand.audiences',
              value:
                language === 'ar'
                  ? 'عملاء يبحثون عن حلول موثوقة.'
                  : 'Customers looking for a reliable solution.',
              kind: 'inference' as const,
              confidence: 0.4,
              evidenceRefs: input.evidenceRefs,
            },
            {
              field: 'brand.messaging',
              value:
                language === 'ar'
                  ? 'قيمة واضحة مدعومة بالدليل.'
                  : 'Clear value supported by evidence.',
              kind: 'inference' as const,
              confidence: 0.4,
              evidenceRefs: input.evidenceRefs,
            },
          ]
        : []),
    ],
    banner: AI_PROPOSAL_BANNER,
  };
}
