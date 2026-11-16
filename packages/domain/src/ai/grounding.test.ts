import { describe, expect, it } from 'vitest';
import { buildBrandContext, emptyBrandContext } from './brand-context';
import { channelLimits, lengthBudget } from './generation';
import {
  buildContractFor,
  deterministicGroundedGeneration,
  moderateGroundedOutput,
  type GroundingContext,
} from './grounding';
import { detectTextLanguage, matchesLanguage } from './language';
import { AI_PROPOSAL_BANNER } from './proposal';

const brand = buildBrandContext({
  tenantId: 't1',
  brandId: 'b1',
  brandName: 'Acme Juice',
  profile: {
    id: 'p1',
    tenantId: 't1',
    brandId: 'b1',
    status: 'APPROVED',
    sectionsJson: JSON.stringify({
      overview: { description: 'Fresh cold-pressed juices' },
      catalog: { products: 'Orange juice' },
      banned_words: ['miracle'],
    }),
  },
  claims: [
    {
      id: 'claim-1',
      fieldKey: 'brand.offer',
      text: 'Free delivery over 20 USD',
      reviewStatus: 'ACCEPTED',
    },
    { id: 'claim-2', fieldKey: 'brand.messaging', text: 'cures colds', reviewStatus: 'REJECTED' },
  ],
});
const generic = emptyBrandContext({ tenantId: 't1', brandId: 'b1', brandName: 'Acme Juice' });

function ctxFor(b = brand, language: 'en' | 'ar' = 'en', channel = 'instagram'): GroundingContext {
  const limits = channelLimits(channel);
  return { brand: b, limits, maxChars: lengthBudget('medium', limits), language };
}

function output(variants: Array<Record<string, unknown>>, language = 'en') {
  return {
    promptId: 'oma.caption_generation',
    promptVersion: '2',
    schemaVersion: '2',
    language,
    sourceVersion: 'p1',
    banner: AI_PROPOSAL_BANNER,
    variants,
    hashtags: [],
    warnings: [],
  };
}

const plain = { rationale: 'r', factual: false, groundingRefs: [] };

describe('brand context grounding refs', () => {
  it('tags accepted claims and profile sections, never rejected claims', () => {
    const refs = brand.groundingRefs.map((r) => r.ref);
    expect(refs).toEqual(expect.arrayContaining(['C1', 'P-overview', 'P-products']));
    expect(brand.groundingRefs.find((r) => r.ref === 'C1')?.sourceId).toBe('claim-1');
    expect(brand.compactText).toContain('[C1] brand.offer: Free delivery');
    expect(brand.compactText).toContain('[P-overview] overview:');
    expect(brand.groundingRefs.some((r) => r.label.includes('cures colds'))).toBe(false);
  });

  it('a generic context offers no refs', () => {
    expect(generic.groundingRefs).toEqual([]);
    expect(buildContractFor('caption', ctxFor(generic)).options.allowedRefs).toEqual([]);
  });
});

describe('grounded content contract', () => {
  const contract = buildContractFor('caption', ctxFor());

  it('accepts cited facts', () => {
    const r = contract.parse(
      output([
        {
          text: 'Free delivery on orders over 20 USD.',
          rationale: 'r',
          factual: true,
          groundingRefs: ['C1'],
        },
        { text: 'Start your morning fresh.', ...plain },
      ]),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects an invented ref', () => {
    const r = contract.parse(
      output([
        { text: 'Our juice wins awards.', rationale: 'r', factual: true, groundingRefs: ['C9'] },
        { text: 'Start your morning fresh.', ...plain },
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join('\n')).toMatch(/unknown grounding ref "C9"/);
  });

  it('rejects any ref when the brand is generic', () => {
    const r = buildContractFor('caption', ctxFor(generic)).parse(
      output([
        { text: 'Fresh juice daily.', rationale: 'r', factual: true, groundingRefs: ['C1'] },
        { text: 'Start your morning fresh.', ...plain },
      ]),
    );
    expect(r.ok).toBe(false);
  });

  it('rejects a factual variant or a figure without a ref', () => {
    const factual = contract.parse(
      output([
        { text: 'We deliver in one hour.', rationale: 'r', factual: true, groundingRefs: [] },
        { text: 'Start your morning fresh.', ...plain },
      ]),
    );
    expect(factual.ok).toBe(false);
    const figure = contract.parse(
      output([
        { text: 'Now 30% off every bottle!', ...plain },
        { text: 'Start your morning fresh.', ...plain },
      ]),
    );
    expect(figure.ok).toBe(false);
    if (!figure.ok) expect(figure.issues.join('\n')).toMatch(/prices and percentages/);
  });

  it('rejects the wrong language and a wrong language field', () => {
    const ar = buildContractFor('caption', ctxFor(brand, 'ar'));
    const english = ar.parse(
      output(
        [
          { text: 'Start your morning with fresh juice.', ...plain },
          { text: 'Fresh every single day for you.', ...plain },
        ],
        'ar',
      ),
    );
    expect(english.ok).toBe(false);
    if (!english.ok) expect(english.issues.join('\n')).toMatch(/Arabic/);
    const arabic = ar.parse(
      output(
        [
          { text: 'ابدأ صباحك مع عصير Acme Juice الطازج.', ...plain },
          { text: 'طازج كل يوم من أجلك.', ...plain },
        ],
        'ar',
      ),
    );
    expect(arabic.ok).toBe(true);
    const wrongField = ar.parse(
      output(
        [
          { text: 'ابدأ صباحك مع العصير الطازج.', ...plain },
          { text: 'طازج كل يوم من أجلك.', ...plain },
        ],
        'en',
      ),
    );
    expect(wrongField.ok).toBe(false);
  });

  it('rejects text over the channel limit instead of trimming it', () => {
    const x = buildContractFor('caption', ctxFor(brand, 'en', 'x'));
    const r = x.parse(
      output([
        { text: 'a'.repeat(400), ...plain },
        { text: 'Start your morning fresh.', ...plain },
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join('\n')).toContain('variants.0.text');
  });
});

describe('grounded moderation', () => {
  it('drops banned variants and resolves cited refs', () => {
    const out = moderateGroundedOutput(
      output([
        { text: 'A miracle in a bottle.', ...plain },
        {
          text: 'Free delivery over 20 USD.',
          rationale: 'r',
          factual: true,
          groundingRefs: ['C1'],
        },
      ]) as never,
      brand,
    );
    expect(out.dropped).toBe(1);
    expect(out.value.variants).toHaveLength(1);
    expect(out.warnings).toContain('banned_claim:miracle');
    expect(out.refs).toEqual([
      expect.objectContaining({ ref: 'C1', kind: 'claim', source_id: 'claim-1' }),
    ]);
    expect(out.grounded).toBe(true);
  });

  it('drops a reply that repeats a rejected claim', () => {
    const out = moderateGroundedOutput(
      output([{ text: 'Our juice cures colds fast.', ...plain }]) as never,
      brand,
    );
    expect(out.value.variants).toHaveLength(0);
  });
});

describe('deterministic grounded generation', () => {
  it('is valid for every kind, language and channel', () => {
    for (const kind of ['caption', 'rewrite', 'idea', 'alt', 'hashtags', 'inbox_reply'] as const) {
      for (const language of ['en', 'ar'] as const) {
        for (const channel of ['instagram', 'x', 'snapchat', 'whatsapp']) {
          for (const b of [brand, generic]) {
            const ctx = ctxFor(b, language, channel);
            const value = deterministicGroundedGeneration({
              kind,
              ctx,
              promptId: 'p',
              promptVersion: '2',
              caption: kind === 'rewrite' ? 'Fresh juice' : undefined,
            });
            const r = buildContractFor(kind, ctx).parse(value);
            if (!r.ok) throw new Error(`${kind}/${language}/${channel}: ${r.issues.join('; ')}`);
          }
        }
      }
    }
  });
});

describe('language detection', () => {
  it('detects Arabic and English and ignores brand names and links', () => {
    expect(detectTextLanguage('مرحبا، أريد أن أعرف موعد التوصيل')).toBe('ar');
    expect(detectTextLanguage('Hello, when will my order arrive?')).toBe('en');
    expect(detectTextLanguage('hi')).toBeNull();
    expect(
      matchesLanguage('شكراً لك Acme Juice Company https://acme.example', 'ar', [
        'Acme Juice Company',
      ]),
    ).toBe(true);
  });
});
