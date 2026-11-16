import { AI_PROPOSAL_BANNER } from '../proposal';
import { brandAnalysisSchemaV2, type BrandAnalysisV2 } from './brand-analysis';
import { AI_CONTRACT_SCHEMA_VERSION } from './common';
import { toProviderJsonSchema } from './json-schema';
import { parseAiOutput, type AiContractId } from './registry';
import {
  strategyFoundationSchemaV2,
  strategyFoundationTrackIssues,
  type StrategyFoundationV2,
} from './strategy-foundation';

/**
 * Per-call brand analysis contract: evidence refs must be ids that were actually
 * sent to the model (top-level and per item).
 */
export function brandAnalysisContractFor(knownEvidenceIds: readonly string[]) {
  const known = new Set(knownEvidenceIds);
  const schema = brandAnalysisSchemaV2.superRefine((value, ctx) => {
    value.evidenceRefs.forEach((ref, i) => {
      if (!known.has(ref)) {
        ctx.addIssue({
          code: 'custom',
          path: ['evidenceRefs', i],
          message: `unknown evidence id "${ref}"; cite only ids from the evidence list`,
        });
      }
    });
    value.items.forEach((item, i) => {
      item.evidenceRefs.forEach((ref, j) => {
        if (!known.has(ref)) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', i, 'evidenceRefs', j],
            message: `unknown evidence id "${ref}"; cite only ids from the evidence list`,
          });
        }
      });
    });
  });
  return {
    contractId: 'brand.analysis' as AiContractId,
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    schema,
    jsonSchema: () => toProviderJsonSchema(brandAnalysisSchemaV2),
    parse: (raw: unknown) => parseAiOutput(schema, raw),
  };
}

/** Per-call strategy foundation contract: disabled tracks must be null. */
export function strategyFoundationContractFor(tracks: { organic: boolean; paid: boolean }) {
  const schema = strategyFoundationSchemaV2.superRefine((value, ctx) => {
    for (const message of strategyFoundationTrackIssues(value, tracks)) {
      ctx.addIssue({ code: 'custom', path: [message.split(':')[0]!], message });
    }
  });
  return {
    contractId: 'strategy.foundation' as AiContractId,
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    schema,
    jsonSchema: () => toProviderJsonSchema(strategyFoundationSchemaV2),
    parse: (raw: unknown) => parseAiOutput(schema, raw),
  };
}

/** Schema version of a stored proposal: v1 runs are legacy and display-only (DEC-027 #9). */
export function storedProposalVersion(proposalJson: string | null): '1' | '2' | 'unknown' {
  if (!proposalJson) return 'unknown';
  try {
    const v = (JSON.parse(proposalJson) as { schemaVersion?: unknown }).schemaVersion;
    return v === '1' || v === '2' ? v : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function deterministicBrandAnalysisV2(input: {
  promptId: string;
  promptVersion: string;
  sourceVersion: string;
  evidenceRefs: string[];
  language?: 'en' | 'ar';
}): BrandAnalysisV2 {
  const ar = input.language === 'ar';
  const refs = input.evidenceRefs.slice(0, 20);
  const item = (
    field: BrandAnalysisV2['items'][number]['field'],
    en: string,
    arText: string,
    kind: 'fact' | 'inference' | 'proposal',
    confidence: number,
  ) => ({ field, value: ar ? arText : en, kind, confidence, evidenceRefs: refs });
  return {
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    language: ar ? 'ar' : 'en',
    sourceVersion: input.sourceVersion,
    banner: AI_PROPOSAL_BANNER,
    evidenceRefs: input.evidenceRefs.slice(0, 50),
    items: [
      item(
        'brand.description',
        'Test brand description grounded in scan evidence.',
        'وصف تجريبي للعلامة من الأدلة.',
        refs.length ? 'fact' : 'proposal',
        0.55,
      ),
      item('brand.tone', 'Professional and clear.', 'نبرة مهنية وواضحة.', 'inference', 0.45),
      item(
        'brand.audiences',
        'Customers looking for a reliable solution.',
        'عملاء يبحثون عن حلول موثوقة.',
        'inference',
        0.4,
      ),
      item(
        'brand.messaging',
        'Clear value supported by evidence.',
        'قيمة واضحة مدعومة بالدليل.',
        'inference',
        0.4,
      ),
    ],
  };
}

export function deterministicStrategyFoundationV2(input: {
  promptId: string;
  promptVersion: string;
  sourceVersion: string;
  tracks: { organic: boolean; paid: boolean };
  language?: 'en' | 'ar';
  brandName?: string;
}): StrategyFoundationV2 {
  const ar = input.language === 'ar';
  const brand = input.brandName || 'Brand';
  const t = (en: string, arText: string) => (ar ? arText : en);
  return {
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    language: ar ? 'ar' : 'en',
    sourceVersion: input.sourceVersion,
    banner: AI_PROPOSAL_BANNER,
    rationale: t('Deterministic test proposal.', 'مقترح تجريبي ثابت.'),
    foundation: {
      goals: [t(`Grow awareness of ${brand}`, `زيادة الوعي بـ ${brand}`)],
      positioning: t(`${brand} as a trusted choice`, `${brand} خيار موثوق`),
      keyMessages: [t('Quality you can rely on', 'جودة يمكنك الاعتماد عليها')],
      constraints: [],
    },
    audienceGoals: [t('Reach new local customers', 'الوصول إلى عملاء محليين جدد')],
    kpis: [t('Monthly reach', 'الوصول الشهري')],
    organic: input.tracks.organic
      ? {
          pillars: [t('Product education', 'التعريف بالمنتج')],
          channels: ['instagram'],
          formats: ['reel'],
          frequency: t('3 posts per week', '3 منشورات أسبوعياً'),
        }
      : null,
    paid: input.tracks.paid
      ? {
          campaignObjectives: [t('Lead generation', 'جذب العملاء المحتملين')],
          offerAngle: t('First order discount', 'خصم على الطلب الأول'),
          placements: ['instagram_feed'],
        }
      : null,
  };
}
