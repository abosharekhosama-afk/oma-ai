import { discoveryTierForField, type DiscoveryTier } from '../brand/discovery-tiers';
import { AI_PROPOSAL_BANNER } from './proposal';

/** Shape shared by the v2 `brand.analysis` contract and legacy v1 proposals. */
export type BrandAnalysisProposal = {
  promptId: string;
  promptVersion: string;
  language: 'en' | 'ar';
  sourceVersion: string;
  banner: string;
  evidenceRefs: string[];
  items: Array<{
    field: string;
    value: string;
    kind: 'fact' | 'inference' | 'proposal';
    confidence?: number;
    evidenceRefs: string[];
  }>;
};

export type InsightWrite = {
  fieldKey: string;
  textValue: string;
  valueJson: string;
  evidenceId: string | null;
  evidenceRefs: string[];
  confidence: number | null;
  infoState: 'AI_INFERRED';
  discoveryTier: DiscoveryTier;
  createdBy: 'AI';
  kind: 'fact' | 'inference' | 'proposal';
};

const SECTION_FIELDS = new Set([
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
]);

function firstKnownEvidence(refs: string[], known: Set<string>): string | null {
  for (const ref of refs) {
    if (known.has(ref)) return ref;
  }
  return null;
}

export function insightWritesFromProposal(
  proposal: BrandAnalysisProposal,
  knownEvidenceIds: Set<string>,
): InsightWrite[] {
  const writes: InsightWrite[] = [];
  for (const item of proposal.items) {
    if (
      !SECTION_FIELDS.has(item.field) &&
      !item.field.startsWith('brand.') &&
      !item.field.startsWith('catalog.')
    ) {
      continue;
    }
    const evidenceRefs = item.evidenceRefs.length > 0 ? item.evidenceRefs : proposal.evidenceRefs;
    writes.push({
      fieldKey: item.field,
      textValue: item.value,
      valueJson: JSON.stringify({
        value: item.value,
        kind: item.kind,
        confidence: item.confidence ?? null,
        evidenceRefs,
        banner: AI_PROPOSAL_BANNER,
      }),
      evidenceId: firstKnownEvidence(evidenceRefs, knownEvidenceIds),
      evidenceRefs,
      confidence: item.confidence ?? null,
      infoState: 'AI_INFERRED',
      discoveryTier: discoveryTierForField(item.field),
      createdBy: 'AI',
      kind: item.kind,
    });
  }
  return writes;
}

export function visualIdentityFromObservations(
  observations: Array<{ fieldKey: string; valueJson: string | null }>,
): Record<string, unknown> {
  const identity: Record<string, unknown> = {
    colors: [],
    logos: [],
    favicon: null,
    og_image: null,
  };
  for (const obs of observations) {
    if (!obs.valueJson) continue;
    let value: unknown;
    try {
      value = JSON.parse(obs.valueJson);
    } catch {
      continue;
    }
    if (obs.fieldKey === 'brand.colors' && value && typeof value === 'object') {
      const theme = (value as { theme?: unknown }).theme;
      if (Array.isArray(theme)) identity.colors = theme;
    }
    if (obs.fieldKey === 'brand.logo' && value && typeof value === 'object') {
      const logo = value as { urls?: unknown; favicon?: unknown; og_image?: unknown };
      if (Array.isArray(logo.urls)) identity.logos = logo.urls;
      if (typeof logo.favicon === 'string') identity.favicon = logo.favicon;
      if (typeof logo.og_image === 'string') identity.og_image = logo.og_image;
    }
  }
  return identity;
}

export function mergeAiSections(
  current: Record<string, unknown>,
  proposal: BrandAnalysisProposal,
  extras: { visualIdentity?: Record<string, unknown>; aiRunId?: string } = {},
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current };
  const pick = (field: string) => proposal.items.find((item) => item.field === field)?.value;

  const overview = {
    ...(typeof next.overview === 'object' && next.overview ? next.overview : {}),
  } as Record<string, unknown>;
  if (pick('brand.name')) overview.name = pick('brand.name');
  if (pick('brand.description')) overview.description = pick('brand.description');
  if (pick('brand.categories')) overview.categories = pick('brand.categories');
  next.overview = overview;

  if (pick('brand.tone')) next.tone = { summary: pick('brand.tone') };
  if (pick('brand.audiences')) next.audiences = { summary: pick('brand.audiences') };
  if (pick('brand.messaging')) next.messaging = { summary: pick('brand.messaging') };
  if (pick('brand.languages')) next.languages = { summary: pick('brand.languages') };
  if (pick('brand.contact')) {
    next.contact = {
      ...(typeof next.contact === 'object' && next.contact ? next.contact : {}),
      summary: pick('brand.contact'),
    };
  }
  if (pick('brand.social')) {
    next.social = {
      ...(typeof next.social === 'object' && next.social ? next.social : {}),
      summary: pick('brand.social'),
    };
  }
  if (pick('catalog.products') || pick('catalog.services')) {
    next.catalog = {
      ...(typeof next.catalog === 'object' && next.catalog ? next.catalog : {}),
      products: pick('catalog.products'),
      services: pick('catalog.services'),
    };
  }

  const visual = {
    ...((typeof next.visual_identity === 'object' && next.visual_identity) || {}),
    ...(extras.visualIdentity ?? {}),
  } as Record<string, unknown>;
  if (pick('brand.colors')) visual.ai_colors = pick('brand.colors');
  if (pick('brand.logo')) visual.ai_logo = pick('brand.logo');
  next.visual_identity = visual;

  next.ai_analysis = {
    // Provenance: these sections are an AI proposal on a draft until a human approves.
    run_id: extras.aiRunId ?? null,
    origin: 'AI_PROPOSED',
    fields: [...new Set(proposal.items.map((item) => item.field))],
    promptId: proposal.promptId,
    promptVersion: proposal.promptVersion,
    language: proposal.language,
    banner: proposal.banner,
    sourceVersion: proposal.sourceVersion,
  };
  return next;
}

export function shouldSkipApprovedProfile(status: string): boolean {
  return status === 'APPROVED' || status === 'SUPERSEDED';
}

function tryParseJson(raw: string | null | undefined): unknown {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Apply an accepted insight to profile sections, using structured `valueJson` when present
 * (logo/colors/contact/social/languages from crawl observations).
 */
export function applyAcceptedInsightClaimToSections(
  current: Record<string, unknown>,
  fieldKey: string,
  textValue: string | null | undefined,
  valueJson: string | null | undefined,
): Record<string, unknown> {
  if (fieldKey === 'brand.logo' || fieldKey === 'brand.colors') {
    const rowJson =
      valueJson ??
      (() => {
        const parsed = tryParseJson(textValue ?? null);
        return parsed != null ? JSON.stringify(parsed) : null;
      })();
    if (!rowJson) return current;
    const mergedVisual = visualIdentityFromObservations([{ fieldKey, valueJson: rowJson }]);
    const next = { ...current };
    const visual = {
      ...(typeof next.visual_identity === 'object' && next.visual_identity
        ? next.visual_identity
        : {}),
      ...mergedVisual,
    } as Record<string, unknown>;
    next.visual_identity = visual;
    return next;
  }

  if (fieldKey === 'brand.contact' || fieldKey === 'brand.social') {
    const parsed = tryParseJson(valueJson) ?? tryParseJson(textValue ?? null);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const next = { ...current };
      const sectionKey = fieldKey === 'brand.contact' ? 'contact' : 'social';
      next[sectionKey] = {
        ...(typeof next[sectionKey] === 'object' && next[sectionKey] ? next[sectionKey] : {}),
        ...(parsed as Record<string, unknown>),
      };
      return next;
    }
  }

  if (fieldKey === 'brand.languages') {
    const parsed = tryParseJson(valueJson) ?? tryParseJson(textValue ?? null);
    if (Array.isArray(parsed)) {
      const next = { ...current };
      next.languages = {
        ...(typeof next.languages === 'object' && next.languages ? next.languages : {}),
        items: parsed,
      };
      return next;
    }
  }

  return applyAcceptedInsightToSections(current, fieldKey, textValue);
}

/** Mirror worker merge rules when a human accepts a single AI insight (API path). */
export function applyAcceptedInsightToSections(
  current: Record<string, unknown>,
  fieldKey: string,
  textValue: string | null | undefined,
): Record<string, unknown> {
  const value = textValue?.trim();
  if (!value) return current;
  const next: Record<string, unknown> = { ...current };

  const overview = {
    ...(typeof next.overview === 'object' && next.overview ? next.overview : {}),
  } as Record<string, unknown>;

  switch (fieldKey) {
    case 'brand.name':
      overview.name = value;
      next.overview = overview;
      break;
    case 'brand.description':
      overview.description = value;
      next.overview = overview;
      break;
    case 'brand.categories':
      overview.categories = value;
      next.overview = overview;
      break;
    case 'brand.tone':
      next.tone = { summary: value };
      break;
    case 'brand.audiences':
      next.audiences = { summary: value };
      break;
    case 'brand.messaging':
      next.messaging = { summary: value };
      break;
    case 'brand.languages':
      next.languages = { summary: value };
      break;
    case 'brand.contact':
      next.contact = {
        ...(typeof next.contact === 'object' && next.contact ? next.contact : {}),
        summary: value,
      };
      break;
    case 'brand.social':
      next.social = {
        ...(typeof next.social === 'object' && next.social ? next.social : {}),
        summary: value,
      };
      break;
    case 'catalog.products':
    case 'catalog.services': {
      const catalog = {
        ...(typeof next.catalog === 'object' && next.catalog ? next.catalog : {}),
      } as Record<string, unknown>;
      const sectionKey = fieldKey === 'catalog.products' ? 'products' : 'services';
      try {
        const parsed = JSON.parse(value) as unknown;
        catalog[sectionKey] = parsed;
      } catch {
        catalog[sectionKey] = value;
      }
      next.catalog = catalog;
      break;
    }
    case 'brand.colors':
    case 'brand.logo': {
      const visual = {
        ...(typeof next.visual_identity === 'object' && next.visual_identity
          ? next.visual_identity
          : {}),
      } as Record<string, unknown>;
      if (fieldKey === 'brand.colors') visual.ai_colors = value;
      if (fieldKey === 'brand.logo') visual.ai_logo = value;
      next.visual_identity = visual;
      break;
    }
    default:
      break;
  }
  return next;
}
