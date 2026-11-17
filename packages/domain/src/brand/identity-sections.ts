import {
  applyAcceptedInsightClaimToSections,
  visualIdentityFromObservations,
} from '../ai/apply-proposal';

export const BRAND_IDENTITY_SECTION_KEYS = [
  'overview',
  'tone',
  'audiences',
  'messaging',
  'visual_identity',
  'contact',
  'social',
  'languages',
] as const;

export type BrandIdentitySectionKey = (typeof BRAND_IDENTITY_SECTION_KEYS)[number];

export type IdentityInsightRow = {
  fieldKey: string;
  textValue: string | null;
  valueJson: string | null;
  reviewStatus: string;
};

export type BrandIdentityCompleteness = {
  sections: Record<BrandIdentitySectionKey, boolean>;
  filled_count: number;
  total_count: number;
  percent: number;
  /** FR-BWI-026 optional identity narrative slices */
  narrative_ready: boolean;
};

function sectionHasContent(
  key: BrandIdentitySectionKey,
  sections: Record<string, unknown>,
): boolean {
  const value = sections[key];
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  if (key === 'overview') {
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const description = typeof rec.description === 'string' ? rec.description.trim() : '';
    return name.length > 0 || description.length > 0;
  }
  if (key === 'visual_identity') {
    const colors = rec.colors ?? rec.theme;
    const logos = rec.logos;
    return (
      (Array.isArray(colors) && colors.length > 0) ||
      (Array.isArray(logos) && logos.length > 0) ||
      typeof rec.favicon === 'string' ||
      typeof rec.og_image === 'string' ||
      typeof rec.ai_colors === 'string' ||
      typeof rec.ai_logo === 'string'
    );
  }
  const summary = typeof rec.summary === 'string' ? rec.summary.trim() : '';
  if (summary.length > 0) return true;
  return Object.keys(rec).some((k) => {
    const v = rec[k];
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim().length > 0;
    return true;
  });
}

export function computeBrandIdentityCompleteness(
  sections: Record<string, unknown>,
): BrandIdentityCompleteness {
  const filled: Record<BrandIdentitySectionKey, boolean> = {
    overview: sectionHasContent('overview', sections),
    tone: sectionHasContent('tone', sections),
    audiences: sectionHasContent('audiences', sections),
    messaging: sectionHasContent('messaging', sections),
    visual_identity: sectionHasContent('visual_identity', sections),
    contact: sectionHasContent('contact', sections),
    social: sectionHasContent('social', sections),
    languages: sectionHasContent('languages', sections),
  };
  const filled_count = BRAND_IDENTITY_SECTION_KEYS.filter((k) => filled[k]).length;
  const total_count = BRAND_IDENTITY_SECTION_KEYS.length;
  const percent = total_count > 0 ? Math.round((filled_count / total_count) * 100) : 0;
  const narrative_ready =
    filled.overview &&
    filled.visual_identity &&
    (filled.tone || filled.messaging) &&
    (filled.audiences || filled.messaging);
  return {
    sections: filled,
    filled_count,
    total_count,
    percent,
    narrative_ready,
  };
}

export function reconcileIdentitySectionsFromInsights(
  current: Record<string, unknown>,
  insights: IdentityInsightRow[],
): Record<string, unknown> {
  let next = { ...current };
  for (const insight of insights) {
    if (insight.reviewStatus !== 'ACCEPTED') continue;
    if (!insight.textValue && !insight.valueJson) continue;
    next = applyAcceptedInsightClaimToSections(
      next,
      insight.fieldKey,
      insight.textValue,
      insight.valueJson,
    );
  }
  return next;
}

type ObsRow = { fieldKey: string; valueJson: string | null };

function parseObsValue(valueJson: string | null): unknown {
  if (!valueJson) return null;
  try {
    return JSON.parse(valueJson) as unknown;
  } catch {
    return valueJson;
  }
}

/** Seed profile `sectionsJson` identity slices from crawl observations (rule-based). */
export function bootstrapIdentitySectionsFromObservations(
  observations: ObsRow[],
): Record<string, unknown> {
  const overview: Record<string, unknown> = {};
  let contact: Record<string, unknown> = {};
  let social: Record<string, unknown> = {};
  let languages: Record<string, unknown> = {};

  for (const obs of observations) {
    const value = parseObsValue(obs.valueJson);
    switch (obs.fieldKey) {
      case 'brand.name':
        if (typeof value === 'string' && value.trim()) overview.name = value.trim();
        break;
      case 'brand.description':
        if (typeof value === 'string' && value.trim()) overview.description = value.trim();
        break;
      case 'brand.contact':
        if (value && typeof value === 'object') {
          contact = { ...(value as Record<string, unknown>) };
        }
        break;
      case 'brand.social':
        if (value && typeof value === 'object') {
          social = { ...(value as Record<string, unknown>) };
        } else if (typeof value === 'string' && value.trim()) {
          social = { summary: value.trim() };
        }
        break;
      case 'brand.languages':
        if (Array.isArray(value) && value.length > 0) {
          languages = { items: value };
        } else if (typeof value === 'string' && value.trim()) {
          languages = { summary: value.trim() };
        }
        break;
      default:
        break;
    }
  }

  const visual_identity = visualIdentityFromObservations(observations);

  return {
    overview,
    contact,
    social,
    languages,
    visual_identity,
  };
}
