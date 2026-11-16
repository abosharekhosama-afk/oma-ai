import { catalogOfferingsFromProfileSections } from '../brand/catalog-offerings';
import { estimateTokens } from './pricing';

export const DEFAULT_BRAND_CONTEXT_TOKEN_BUDGET = 1200;

export type BrandContextClaim = {
  /** InsightClaim id, used as the source of a grounding ref. */
  id?: string;
  fieldKey: string;
  text: string;
  reviewStatus: 'ACCEPTED' | 'REJECTED' | 'PENDING' | string;
};

export type BrandContextVisualIdentity = {
  colors: string[];
  logos: string[];
  favicon: string | null;
  ogImage: string | null;
  notes: string[];
};

/** A citable fact in the brand context. `ref` is the short id the model sees. */
export type GroundingRef = {
  ref: string;
  kind: 'claim' | 'profile';
  /** InsightClaim id for claims, profile section key for profile refs. */
  sourceId: string;
  label: string;
};

/** Profile sections a model may cite, with their ref ids. */
export const PROFILE_GROUNDING_SECTIONS = [
  ['overview', 'P-overview'],
  ['toneOfVoice', 'P-tone'],
  ['audiences', 'P-audiences'],
  ['messaging', 'P-messaging'],
  ['products', 'P-products'],
  ['services', 'P-services'],
] as const;

export type BrandContext = {
  tenantId: string;
  brandId: string;
  brandName: string;
  usedApprovedProfile: boolean;
  profileVersionId: string | null;
  overview: string;
  toneOfVoice: string;
  audiences: string;
  messaging: string;
  products: string;
  services: string;
  languages: Array<'en' | 'ar'>;
  visualIdentity: BrandContextVisualIdentity;
  doClaims: string[];
  dontClaims: string[];
  bannedWords: string[];
  /** Facts the model may cite (only those still present in compactText). */
  groundingRefs: GroundingRef[];
  compactText: string;
  estimatedTokens: number;
  truncated: boolean;
};

export type BrandContextSource = {
  tenantId: string;
  brandId: string;
  brandName: string;
  profile: {
    id: string;
    tenantId: string;
    brandId: string;
    status: string;
    sectionsJson: string | null;
  } | null;
  claims?: BrandContextClaim[];
  maxTokens?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(readString).filter(Boolean).join('; ');
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec.summary === 'string') return rec.summary.trim();
    if (typeof rec.description === 'string') return rec.description.trim();
    if (typeof rec.value === 'string') return rec.value.trim();
    if (Array.isArray(rec.items)) return rec.items.map(readString).filter(Boolean).join('; ');
  }
  return '';
}

function parseSections(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function detectLanguages(
  value: unknown,
  fallback: Array<'en' | 'ar'> = ['en'],
): Array<'en' | 'ar'> {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item).toLowerCase())
    : readString(value)
        .split(/[,;/]/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
  const found: Array<'en' | 'ar'> = [];
  if (raw.some((item) => item.startsWith('ar') || item.includes('arabic'))) found.push('ar');
  if (raw.some((item) => item.startsWith('en') || item.includes('english'))) found.push('en');
  return found.length ? found : fallback;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(readString).filter(Boolean);
  const text = readString(value);
  return text ? [text] : [];
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function emptyBrandContext(input: {
  tenantId: string;
  brandId: string;
  brandName: string;
}): BrandContext {
  const brandName = input.brandName.trim() || 'Brand';
  const compactText = `brandName: ${brandName}\nusedApprovedProfile: false`;
  return {
    tenantId: input.tenantId,
    brandId: input.brandId,
    brandName,
    usedApprovedProfile: false,
    profileVersionId: null,
    overview: '',
    toneOfVoice: '',
    audiences: '',
    messaging: '',
    products: '',
    services: '',
    languages: ['en'],
    visualIdentity: { colors: [], logos: [], favicon: null, ogImage: null, notes: [] },
    doClaims: [],
    dontClaims: [],
    bannedWords: [],
    groundingRefs: [],
    compactText,
    estimatedTokens: estimateTokens(compactText),
    truncated: false,
  };
}

export function buildBrandContext(input: BrandContextSource): BrandContext {
  const base = emptyBrandContext(input);
  const profile = input.profile;
  if (!profile || profile.status !== 'APPROVED') return base;
  if (profile.tenantId !== input.tenantId || profile.brandId !== input.brandId) {
    return base;
  }

  const sections = parseSections(profile.sectionsJson);
  const overview = asRecord(sections.overview);
  const catalog = asRecord(sections.catalog);
  const visual = asRecord(sections.visual_identity);
  const banned = stringList(sections.banned_words ?? sections.bannedWords);
  const acceptedAll = (input.claims ?? []).filter(
    (claim) => claim.reviewStatus === 'ACCEPTED' && claim.text.trim(),
  );
  const acceptedClaims = acceptedAll.slice(0, 24);
  const accepted = acceptedClaims.map((claim) => `${claim.fieldKey}: ${claim.text.trim()}`);
  const claimRefs: GroundingRef[] = acceptedClaims.map((claim, index) => ({
    ref: `C${index + 1}`,
    kind: 'claim',
    sourceId: claim.id ?? `${claim.fieldKey}#${index + 1}`,
    label: clip(`${claim.fieldKey}: ${claim.text.trim()}`, 120),
  }));
  const rejected = (input.claims ?? [])
    .filter((claim) => claim.reviewStatus === 'REJECTED' && claim.text.trim())
    .map((claim) => `${claim.fieldKey}: ${claim.text.trim()}`);

  const colors = [
    ...stringList(visual.colors),
    ...stringList(visual.ai_colors),
    ...stringList(visual.theme),
  ];
  const logos = [...stringList(visual.logos), ...stringList(visual.ai_logo)];
  const ctx: BrandContext = {
    ...base,
    usedApprovedProfile: true,
    profileVersionId: profile.id,
    overview:
      readString(overview.description) ||
      readString(sections.overview) ||
      acceptedAll.find((claim) => claim.fieldKey === 'brand.description')?.text.trim() ||
      '',
    toneOfVoice: readString(sections.tone) || readString(overview.tone),
    audiences: readString(sections.audiences),
    messaging: readString(sections.messaging),
    products:
      readString(catalog.products) ||
      catalogOfferingsFromProfileSections(sections)
        .filter((item) => item.kind === 'product')
        .map((item) => item.name)
        .join('; '),
    services:
      readString(catalog.services) ||
      catalogOfferingsFromProfileSections(sections)
        .filter((item) => item.kind === 'service')
        .map((item) => item.name)
        .join('; '),
    languages: detectLanguages(sections.languages ?? overview.languages),
    visualIdentity: {
      colors: [...new Set(colors)].slice(0, 12),
      logos: [...new Set(logos)].slice(0, 6),
      favicon: readString(visual.favicon) || null,
      ogImage: readString(visual.og_image) || null,
      notes: [readString(visual.ai_colors), readString(visual.ai_logo)].filter(Boolean),
    },
    doClaims: accepted.map((line, index) => `[C${index + 1}] ${line}`),
    dontClaims: rejected.slice(0, 24),
    bannedWords: banned.slice(0, 40),
    groundingRefs: claimRefs,
    compactText: '',
    estimatedTokens: 0,
    truncated: false,
  };

  return compactBrandContext(ctx, input.maxTokens ?? DEFAULT_BRAND_CONTEXT_TOKEN_BUDGET);
}

export function compactBrandContext(context: BrandContext, maxTokens: number): BrandContext {
  const budget = Math.max(160, maxTokens);
  const next: BrandContext = {
    ...context,
    overview: clip(context.overview, 600),
    toneOfVoice: clip(context.toneOfVoice, 400),
    audiences: clip(context.audiences, 400),
    messaging: clip(context.messaging, 400),
    products: clip(context.products, 400),
    services: clip(context.services, 400),
    doClaims: context.doClaims.map((item) => clip(item, 220)),
    dontClaims: context.dontClaims.map((item) => clip(item, 220)),
    bannedWords: context.bannedWords.map((item) => clip(item, 40)),
  };

  const grounded = context.usedApprovedProfile;
  const tag = (ref: string) => (grounded ? `[${ref}] ` : '');
  const pack = (ctx: BrandContext) =>
    [
      `brandName: ${ctx.brandName}`,
      `usedApprovedProfile: ${ctx.usedApprovedProfile}`,
      `profileVersionId: ${ctx.profileVersionId ?? 'none'}`,
      ctx.overview ? `${tag('P-overview')}overview: ${ctx.overview}` : '',
      ctx.toneOfVoice ? `${tag('P-tone')}toneOfVoice: ${ctx.toneOfVoice}` : '',
      ctx.audiences ? `${tag('P-audiences')}audiences: ${ctx.audiences}` : '',
      ctx.messaging ? `${tag('P-messaging')}messaging: ${ctx.messaging}` : '',
      ctx.products ? `${tag('P-products')}products: ${ctx.products}` : '',
      ctx.services ? `${tag('P-services')}services: ${ctx.services}` : '',
      ctx.languages.length ? `languages: ${ctx.languages.join(',')}` : '',
      ctx.visualIdentity.colors.length ? `colors: ${ctx.visualIdentity.colors.join(',')}` : '',
      ctx.visualIdentity.notes.length ? `visualNotes: ${ctx.visualIdentity.notes.join('; ')}` : '',
      ctx.doClaims.length ? `do: ${ctx.doClaims.join(' | ')}` : '',
      ctx.dontClaims.length ? `dont: ${ctx.dontClaims.join(' | ')}` : '',
      ctx.bannedWords.length ? `bannedWords: ${ctx.bannedWords.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  let compactText = pack(next);
  let truncated = estimateTokens(compactText) > budget;
  const shrinkable: Array<keyof BrandContext> = [
    'doClaims',
    'dontClaims',
    'services',
    'products',
    'audiences',
    'messaging',
    'overview',
  ];
  while (estimateTokens(compactText) > budget) {
    let shrunk = false;
    for (const key of shrinkable) {
      const value = next[key];
      if (Array.isArray(value) && value.length > 1) {
        (next[key] as string[]).pop();
        shrunk = true;
        break;
      }
      if (typeof value === 'string' && value.length > 80) {
        (next as unknown as Record<string, unknown>)[key] = clip(
          value,
          Math.floor(value.length * 0.7),
        );
        shrunk = true;
        break;
      }
    }
    compactText = pack(next);
    truncated = true;
    if (!shrunk) break;
  }

  const profileRefs: GroundingRef[] = grounded
    ? PROFILE_GROUNDING_SECTIONS.filter(([key]) => Boolean(next[key])).map(([key, ref]) => ({
        ref,
        kind: 'profile' as const,
        sourceId: key,
        label: clip(`${key}: ${String(next[key])}`, 120),
      }))
    : [];
  const visible = [...context.groundingRefs.filter((r) => r.kind === 'claim'), ...profileRefs];
  return {
    ...next,
    groundingRefs: visible.filter((r) => compactText.includes(`[${r.ref}]`)),
    compactText,
    estimatedTokens: estimateTokens(compactText),
    truncated,
  };
}

type CacheEntry = { context: BrandContext; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 5 * 60_000;

export function brandContextCacheKey(
  tenantId: string,
  brandId: string,
  profileVersionId: string | null,
) {
  return `${tenantId}:${brandId}:${profileVersionId ?? 'none'}`;
}

export function readBrandContextCache(key: string): BrandContext | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.context;
}

export function writeBrandContextCache(
  key: string,
  context: BrandContext,
  ttlMs = DEFAULT_TTL_MS,
): void {
  cache.set(key, { context, expiresAt: Date.now() + ttlMs });
}

export function invalidateBrandContextCache(tenantId: string, brandId?: string): void {
  const prefix = brandId ? `${tenantId}:${brandId}:` : `${tenantId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function clearBrandContextCache(): void {
  cache.clear();
}
