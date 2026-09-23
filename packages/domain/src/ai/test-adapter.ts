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
    ],
    banner: AI_PROPOSAL_BANNER,
  };
}
