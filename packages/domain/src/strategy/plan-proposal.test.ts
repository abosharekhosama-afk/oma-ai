import { describe, expect, it } from 'vitest';
import {
  deterministicStrategyPlanProposal,
  strategyPlanProposalJsonSchema,
  validateStrategyPlanProposal,
  type AiStrategyPlanProposal,
} from './plan-proposal';

const ctx = {
  brandName: 'Citrus Lab',
  language: 'en' as const,
  products: 'Vitamin C serum, Night cream',
  services: 'Skin consultation',
  audiences: 'Women 25-40 in the Gulf',
};

type JsonNode = Record<string, unknown>;

function walkObjects(node: unknown, visit: (obj: JsonNode) => void) {
  if (Array.isArray(node)) return node.forEach((n) => walkObjects(n, visit));
  if (!node || typeof node !== 'object') return;
  const obj = node as JsonNode;
  if (obj.type === 'object') visit(obj);
  Object.values(obj).forEach((v) => walkObjects(v, visit));
}

describe('strategy plan proposal schema', () => {
  it('emits a strict-mode compatible JSON schema', () => {
    const schema = strategyPlanProposalJsonSchema();
    const text = JSON.stringify(schema);
    expect(text).not.toContain('"$schema"');
    expect(text).not.toContain('minLength');
    expect(text).not.toContain('maxLength');
    let objects = 0;
    walkObjects(schema, (obj) => {
      objects += 1;
      expect(obj.additionalProperties).toBe(false);
      expect([...((obj.required as string[]) ?? [])].sort()).toEqual(
        Object.keys((obj.properties as JsonNode) ?? {}).sort(),
      );
    });
    expect(objects).toBeGreaterThan(5);
  });

  it('auto-splits: only enabled tracks are produced and converted', () => {
    const organicOnly = deterministicStrategyPlanProposal({
      ...ctx,
      tracks: { organic: true, paid: false },
    });
    expect(organicOnly.paid).toBeNull();
    const checked = validateStrategyPlanProposal(
      organicOnly,
      { organic: true, paid: false },
      { source: 'DETERMINISTIC', evidenceRefs: ['pv1'] },
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.inputs.paid).toBeNull();
    expect(checked.inputs.organic!.pillars.every((p) => p.info_class === 'AI_PROPOSAL')).toBe(true);
    expect(checked.inputs.organic!.pillars[0]!.evidence_refs).toEqual(['pv1']);
    expect(checked.inputs.organic!.seo_keywords.map((k) => k.keyword)).toContain('Vitamin C serum');
  });

  it('labels AI metrics as estimates, never measured', () => {
    const both = deterministicStrategyPlanProposal({
      ...ctx,
      tracks: { organic: true, paid: true },
    });
    both.organic!.seo_keywords[0]!.monthly_volume_estimate = 500;
    const checked = validateStrategyPlanProposal(
      both,
      { organic: true, paid: true },
      { source: 'AI_ESTIMATE' },
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const kw = checked.inputs.organic!.seo_keywords[0]!;
    expect(kw).toMatchObject({
      monthly_volume: 500,
      metric_source: 'AI_ESTIMATE',
      source: 'AI_ESTIMATE',
    });
    expect(checked.inputs.organic!.seo_keywords[1]!.metric_source).toBeNull();
    expect(checked.inputs.paid!.allocations.reduce((s, a) => s + a.share_pct, 0)).toBe(100);
    expect(checked.inputs.paid!.experiments[0]!.status).toBe('PLANNED');
  });

  it('rejects missing enabled tracks, extra keys and broken invariants', () => {
    const base = deterministicStrategyPlanProposal({
      ...ctx,
      tracks: { organic: true, paid: false },
    });
    const missing = validateStrategyPlanProposal(
      base,
      { organic: true, paid: true },
      { source: 'AI_ESTIMATE' },
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues[0]!.code).toBe('TRACK_MISSING');

    const extra = { ...base, approved: true } as unknown;
    expect(
      validateStrategyPlanProposal(extra, { organic: true, paid: false }, { source: 'AI_ESTIMATE' })
        .ok,
    ).toBe(false);

    const paid = deterministicStrategyPlanProposal({
      ...ctx,
      tracks: { organic: false, paid: true },
    });
    const broken: AiStrategyPlanProposal = {
      ...paid,
      paid: { ...paid.paid!, allocations: [{ ...paid.paid!.allocations[0]!, share_pct: 70 }] },
    };
    const res = validateStrategyPlanProposal(
      broken,
      { organic: false, paid: true },
      { source: 'AI_ESTIMATE' },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.issues.map((i) => i.code)).toContain('ALLOCATION_NOT_100');
  });

  it('builds Arabic templates without inventing metrics', () => {
    const ar = deterministicStrategyPlanProposal({
      ...ctx,
      language: 'ar',
      products: '',
      services: '',
      audiences: '',
      tracks: { organic: true, paid: true },
    });
    expect(ar.language).toBe('ar');
    expect(ar.organic!.seo_keywords.every((k) => k.monthly_volume_estimate === null)).toBe(true);
    expect(
      validateStrategyPlanProposal(ar, { organic: true, paid: true }, { source: 'DETERMINISTIC' })
        .ok,
    ).toBe(true);
  });
});
