import { describe, expect, it } from 'vitest';
import type { BrandContext } from '@oma/domain';
import { buildContentGenerationPrompt } from './content-generation';

const brand = {
  brandName: 'Acme',
  usedApprovedProfile: false,
  groundingRefs: [],
  compactText: 'Brand: Acme',
  profileVersionId: null,
  languages: ['en'],
} as unknown as BrandContext;

describe('content prompt strategy context (DEC-029 4.4)', () => {
  it('adds the approved strategy block and rule only when context exists', () => {
    const plain = buildContentGenerationPrompt({ kind: 'caption', language: 'en', brand });
    expect(plain.user).not.toContain('Approved strategy context');
    expect(plain.system).not.toContain('approved strategy');

    const grounded = buildContentGenerationPrompt({
      kind: 'caption',
      language: 'en',
      brand,
      strategy: {
        strategy_version_id: 'sv1',
        pillar_key: 'edu',
        pillar_name: 'Education',
        pillar_description: 'How to use the product',
        funnel_stage: 'AWARENESS',
        objective: 'Grow reach',
        audience: 'Gulf women 25-40',
        key_message: 'Quality first',
        cta: 'Shop now',
        target_keyword: 'night cream',
      },
    });
    expect(grounded.system).toContain('executes an approved strategy');
    expect(grounded.user).toContain('pillar=Education (AWARENESS)');
    expect(grounded.user).toContain('targetKeyword=night cream');
    // Strategy context sits outside the untrusted user-input fence.
    expect(grounded.user.indexOf('Approved strategy context')).toBeLessThan(
      grounded.user.indexOf('---BEGIN UNTRUSTED USER INPUT'),
    );
  });
});
