import { describe, expect, it } from 'vitest';
import { AI_PROPOSAL_BANNER } from '../proposal';
import { AI_USE_CASES } from '../use-cases';
import {
  AI_OUTPUT_CONTRACTS,
  AI_UNSUPPORTED_USE_CASES,
  aiContractsForUseCase,
  brandAnalysisSchemaV2,
  contentGenerationSchemaV2,
  isAiUseCaseSupported,
  parseAiOutput,
  strategyFoundationSchemaV2,
  strategyFoundationTrackIssues,
  strictSchemaIssues,
  toProviderJsonSchema,
  uncoveredAiUseCases,
  PROVIDER_UNSUPPORTED_KEYWORDS,
} from './index';

const envelope = {
  promptId: 'oma.caption_generation',
  promptVersion: '2',
  schemaVersion: '2',
  language: 'en',
  sourceVersion: 'pv1',
  banner: AI_PROPOSAL_BANNER,
};

function keysDeep(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => keysDeep(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k !== 'properties') out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
}

describe('AI output contract registry', () => {
  it('covers every use case or lists it as unsupported', () => {
    expect(uncoveredAiUseCases()).toEqual([]);
    for (const u of AI_UNSUPPORTED_USE_CASES) expect(isAiUseCaseSupported(u)).toBe(false);
    const covered = AI_USE_CASES.filter((u) => isAiUseCaseSupported(u));
    expect(covered.length + AI_UNSUPPORTED_USE_CASES.length).toBe(AI_USE_CASES.length);
  });

  it('derives a strict provider schema for every contract', () => {
    for (const c of Object.values(AI_OUTPUT_CONTRACTS)) {
      const schema = c.jsonSchema();
      expect(schema.type, c.id).toBe('object');
      expect(strictSchemaIssues(schema), c.id).toEqual([]);
      const keys = keysDeep(schema);
      for (const k of PROVIDER_UNSUPPORTED_KEYWORDS)
        expect(keys.has(k), `${c.id}:${k}`).toBe(false);
    }
  });

  it('maps use cases to contracts', () => {
    expect(aiContractsForUseCase('alt_text').map((c) => c.id)).toEqual(['content.alt_text']);
    expect(aiContractsForUseCase('brand_profile_synthesis').map((c) => c.id)).toEqual([
      'brand.analysis',
    ]);
    expect(aiContractsForUseCase('translation')).toEqual([]);
  });

  it('strictSchemaIssues flags open or partially required objects', () => {
    expect(
      strictSchemaIssues({ type: 'object', properties: { a: { type: 'string' } }, required: [] }),
    ).toEqual([
      { path: '$', problem: 'additionalProperties must be false' },
      { path: '$.a', problem: 'not required' },
    ]);
  });
});

describe('content contracts', () => {
  const opts = { maxChars: 280, hashtagMax: 3, variantCount: 3 };
  const variants = [
    { text: 'One', rationale: 'a' },
    { text: 'Two', rationale: 'b' },
  ];

  it('accepts a valid caption output', () => {
    const r = parseAiOutput(contentGenerationSchemaV2('caption', opts), {
      ...envelope,
      variants,
      hashtags: ['#oma'],
      warnings: [],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects over-long text, too many variants, extra keys and v1 outputs', () => {
    const schema = contentGenerationSchemaV2('caption', opts);
    const long = parseAiOutput(schema, {
      ...envelope,
      variants: [{ text: 'x'.repeat(281), rationale: '' }, ...variants],
      hashtags: [],
      warnings: [],
    });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.issues.join('\n')).toContain('variants.0.text');

    const many = parseAiOutput(schema, {
      ...envelope,
      variants: [...variants, ...variants],
      hashtags: [],
      warnings: [],
    });
    expect(many.ok).toBe(false);

    const extra = parseAiOutput(schema, {
      ...envelope,
      variants,
      hashtags: [],
      warnings: [],
      x: 1,
    });
    expect(extra.ok).toBe(false);

    const v1 = parseAiOutput(schema, {
      ...envelope,
      schemaVersion: '1',
      variants,
      hashtags: [],
      warnings: [],
    });
    expect(v1.ok).toBe(false);
  });

  it('enforces the channel hashtag limit and hashtag shape', () => {
    const schema = contentGenerationSchemaV2('caption', opts);
    const tooMany = { ...envelope, variants, hashtags: ['#a', '#b', '#c', '#d'], warnings: [] };
    expect(parseAiOutput(schema, tooMany).ok).toBe(false);
    const bad = { ...envelope, variants, hashtags: ['#two words'], warnings: [] };
    expect(parseAiOutput(schema, bad).ok).toBe(false);
    const arabic = { ...envelope, variants, hashtags: ['#عمان'], warnings: [] };
    expect(parseAiOutput(schema, arabic).ok).toBe(true);
  });

  it('alt text: one short variant, no hashtags', () => {
    const schema = contentGenerationSchemaV2('alt', opts);
    const ok = {
      ...envelope,
      variants: [{ text: 'A red mug', rationale: '' }],
      hashtags: [],
      warnings: [],
    };
    expect(parseAiOutput(schema, ok).ok).toBe(true);
    expect(
      parseAiOutput(schema, { ...ok, variants: [{ text: 'A mug #coffee', rationale: '' }] }).ok,
    ).toBe(false);
    expect(parseAiOutput(schema, { ...ok, hashtags: ['#a'] }).ok).toBe(false);
    const big = contentGenerationSchemaV2('alt', { ...opts, maxChars: 5000 });
    expect(
      parseAiOutput(big, { ...ok, variants: [{ text: 'x'.repeat(251), rationale: '' }] }).ok,
    ).toBe(false);
  });

  it('hashtags kind requires at least one hashtag', () => {
    const schema = contentGenerationSchemaV2('hashtags', opts);
    const base = { ...envelope, variants: [{ text: '#a #b', rationale: '' }], warnings: [] };
    expect(parseAiOutput(schema, { ...base, hashtags: [] }).ok).toBe(false);
    expect(parseAiOutput(schema, { ...base, hashtags: ['#a', '#b'] }).ok).toBe(true);
  });

  it('inbox reply: at most three variants, no hashtags', () => {
    const schema = contentGenerationSchemaV2('inbox_reply', { maxChars: 1000, hashtagMax: 10 });
    const one = {
      ...envelope,
      variants: [{ text: 'Hi', rationale: '' }],
      hashtags: [],
      warnings: [],
    };
    expect(parseAiOutput(schema, one).ok).toBe(true);
    expect(parseAiOutput(schema, { ...one, variants: Array(4).fill(one.variants[0]) }).ok).toBe(
      false,
    );
  });
});

describe('brand analysis contract', () => {
  const base = { ...envelope, promptId: 'oma.brand_profile_synthesis', evidenceRefs: ['e1'] };
  const item = {
    field: 'brand.tone',
    value: 'Warm',
    kind: 'inference',
    confidence: 0.6,
    evidenceRefs: [],
  };

  it('accepts known fields and requires facts to cite evidence', () => {
    expect(parseAiOutput(brandAnalysisSchemaV2, { ...base, items: [item] }).ok).toBe(true);
    const fact = { ...item, kind: 'fact' };
    expect(parseAiOutput(brandAnalysisSchemaV2, { ...base, items: [fact] }).ok).toBe(false);
    expect(
      parseAiOutput(brandAnalysisSchemaV2, { ...base, items: [{ ...fact, evidenceRefs: ['e1'] }] })
        .ok,
    ).toBe(true);
  });

  it('rejects unknown fields, missing confidence and out-of-range confidence', () => {
    expect(
      parseAiOutput(brandAnalysisSchemaV2, { ...base, items: [{ ...item, field: 'x.y' }] }).ok,
    ).toBe(false);
    const { confidence: _c, ...noConfidence } = item;
    expect(parseAiOutput(brandAnalysisSchemaV2, { ...base, items: [noConfidence] }).ok).toBe(false);
    expect(
      parseAiOutput(brandAnalysisSchemaV2, { ...base, items: [{ ...item, confidence: 2 }] }).ok,
    ).toBe(false);
  });
});

describe('strategy foundation contract', () => {
  const value = {
    ...envelope,
    promptId: 'oma.strategy_propose',
    rationale: 'Because',
    foundation: { goals: ['Grow'], positioning: null, keyMessages: [], constraints: [] },
    audienceGoals: [],
    kpis: ['Reach'],
    organic: { pillars: ['Education'], channels: ['instagram'], formats: [], frequency: null },
    paid: null,
  };

  it('accepts typed lists and enforces enabled tracks', () => {
    const r = parseAiOutput(strategyFoundationSchemaV2, value);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(strategyFoundationTrackIssues(r.value, { organic: true, paid: false })).toEqual([]);
      expect(strategyFoundationTrackIssues(r.value, { organic: false, paid: false })).toEqual([
        'organic: must be null (track disabled)',
      ]);
    }
  });

  it('rejects free-text instead of lists', () => {
    expect(
      parseAiOutput(strategyFoundationSchemaV2, {
        ...value,
        foundation: { ...value.foundation, goals: 'Grow; Retain' },
      }).ok,
    ).toBe(false);
  });

  it('provider schema keeps nullable tracks required', () => {
    const schema = toProviderJsonSchema(strategyFoundationSchemaV2) as {
      required: string[];
    };
    expect(schema.required).toContain('organic');
    expect(schema.required).toContain('paid');
  });
});
