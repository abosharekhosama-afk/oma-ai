import { z } from 'zod';
import { proposalEnvelope, contractText } from './common';

/** Profile fields the brand-analysis contracts may propose. */
export const BRAND_PROFILE_FIELD_KEYS = [
  'brand.name',
  'brand.description',
  'brand.categories',
  'brand.audiences',
  'brand.tone',
  'brand.messaging',
  'brand.languages',
  'brand.contact',
  'brand.social',
  'brand.logo',
  'brand.colors',
  'catalog.products',
  'catalog.services',
] as const;
export type BrandProfileFieldKey = (typeof BRAND_PROFILE_FIELD_KEYS)[number];

export const BRAND_ANALYSIS_LIMITS = { items: 40, itemRefs: 20, refs: 50, value: 2000 } as const;

const evidenceRef = contractText(64);

export const brandAnalysisItemSchemaV2 = z
  .strictObject({
    field: z.enum(BRAND_PROFILE_FIELD_KEYS),
    value: z.string().trim().max(BRAND_ANALYSIS_LIMITS.value),
    kind: z.enum(['fact', 'inference', 'proposal']),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(evidenceRef).max(BRAND_ANALYSIS_LIMITS.itemRefs),
  })
  .superRefine((item, ctx) => {
    if (item.kind === 'fact' && item.evidenceRefs.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidenceRefs'],
        message: 'a fact must cite at least one evidence id',
      });
    }
  });

/**
 * v2 contract for brand_profile_synthesis, evidence_summary and
 * contradiction_analysis: closed field list, required confidence, cited facts.
 */
export const brandAnalysisSchemaV2 = z.strictObject({
  ...proposalEnvelope,
  evidenceRefs: z.array(evidenceRef).max(BRAND_ANALYSIS_LIMITS.refs),
  items: z.array(brandAnalysisItemSchemaV2).max(BRAND_ANALYSIS_LIMITS.items),
});

export type BrandAnalysisV2 = z.infer<typeof brandAnalysisSchemaV2>;
