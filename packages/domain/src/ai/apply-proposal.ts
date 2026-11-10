import { discoveryTierForField, type DiscoveryTier } from '../brand/discovery-tiers';
import { AI_PROPOSAL_BANNER, type AiProposal } from './proposal';

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
  proposal: AiProposal,
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
  proposal: AiProposal,
  extras: { visualIdentity?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current };
  const pick = (field: string) => proposal.items.find((item) => item.field === field)?.value;

  const overview = {
    ...(typeof next.overview === 'object' && next.overview ? next.overview : {}),
  } as Record<string, unknown>;
  if (pick('brand.description')) overview.description = pick('brand.description');
  if (pick('brand.categories')) overview.categories = pick('brand.categories');
  next.overview = overview;

  if (pick('brand.tone')) next.tone = { summary: pick('brand.tone') };
  if (pick('brand.audiences')) next.audiences = { summary: pick('brand.audiences') };
  if (pick('brand.messaging')) next.messaging = { summary: pick('brand.messaging') };
  if (pick('brand.languages')) next.languages = { summary: pick('brand.languages') };
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
