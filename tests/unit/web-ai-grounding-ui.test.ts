import { describe, expect, it } from 'vitest';
import { aiRefusalReason, mapAiProposal } from '../../apps/web/src/lib/content-ai';
import { aiUsageRates } from '../../apps/web/src/lib/ai-usage-api';

describe('mapAiProposal', () => {
  it('maps grounded v2 payloads, refs and generic flags', () => {
    const p = mapAiProposal(
      {
        run_id: 'r1',
        grounded: true,
        used_approved_profile: true,
        brand_profile_version_id: 'pv1',
        grounding_refs: [{ ref: 'C1', kind: 'claim', sourceId: 'c-1', label: 'Organic' }],
        variants: [
          {
            text: 'Organic coffee',
            factual: true,
            grounding_refs: [{ ref: 'C1', kind: 'claim', sourceId: 'c-1', label: 'Organic' }],
          },
          { text: '  ' },
        ],
      },
      'en',
    );
    expect(p).toMatchObject({
      source: 'ai',
      runId: 'r1',
      grounded: true,
      text: 'Organic coffee',
      groundingRefs: [{ ref: 'C1', kind: 'claim', label: 'Organic' }],
    });
    expect(p!.variants).toHaveLength(1);
    expect(p!.variants[0]).toMatchObject({ factual: true, groundingRefs: [{ ref: 'C1' }] });
  });

  it('returns null without usable text and keeps generic copy marked', () => {
    expect(mapAiProposal({ variants: [] }, 'en')).toBeNull();
    const g = mapAiProposal({ variants: [{ text: 'Hi', generic: true }] }, 'ar');
    expect(g!.grounded).toBe(false);
    expect(g!.variants[0]!.generic).toBe(true);
    expect(g!.banner).toContain('مراجعة');
  });
});

describe('aiRefusalReason', () => {
  const err = (code: string, detail?: string) =>
    Object.assign(new Error('x'), {
      code,
      data: { error: { code, details: detail ? [{ code: detail }] : [] } },
    });

  it('explains banned-claim refusals, generic refusals and invalid output', () => {
    expect(aiRefusalReason(err('AI_REFUSED', 'BANNED_CLAIM'), 'en')).toMatch(/banned words/);
    expect(aiRefusalReason(err('AI_REFUSED', 'BANNED_CLAIM'), 'ar')).toMatch(/محظورة/);
    expect(aiRefusalReason(err('AI_REFUSED'), 'en')).toMatch(/declined/);
    expect(aiRefusalReason(err('SCHEMA_INVALID'), 'en')).toMatch(/repair/);
  });

  it('ignores unrelated errors', () => {
    expect(aiRefusalReason(err('AI_UNAVAILABLE'), 'en')).toBeNull();
    expect(aiRefusalReason(new Error('boom'), 'en')).toBeNull();
  });
});

describe('aiUsageRates', () => {
  it('computes whole percents and handles zero runs', () => {
    expect(aiUsageRates({ runs: 0, repaired: 0, failed: 0 })).toEqual({
      repairPct: 0,
      failurePct: 0,
    });
    expect(aiUsageRates({ runs: 4, repaired: 1, failed: 2 })).toEqual({
      repairPct: 25,
      failurePct: 50,
    });
  });
});
