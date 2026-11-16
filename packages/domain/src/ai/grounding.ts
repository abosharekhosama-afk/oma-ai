import type { BrandContext, GroundingRef } from './brand-context';
import {
  AI_CONTRACT_SCHEMA_VERSION,
  ALT_TEXT_MAX_CHARS,
  contentContractOptions,
  contentGenerationSchemaV2,
  parseAiOutput,
  toProviderJsonSchema,
  type AiContractId,
  type ContentContractKind,
  type ContentGenerationV2,
} from './contracts';
import { collectBannedPhrases, type ChannelLimits } from './generation';
import { matchesLanguage, type AiOutputLanguage } from './language';
import { AI_PROPOSAL_BANNER } from './proposal';

/** Inbox replies are short regardless of the channel's caption limit. */
export const INBOX_REPLY_MAX_CHARS = 1000;

export type GroundingContext = {
  brand: BrandContext;
  limits: ChannelLimits;
  /** Max characters per variant (channel + requested length). */
  maxChars: number;
  language: AiOutputLanguage;
  variantCount?: number;
};

export type ResolvedGroundingRef = {
  ref: string;
  kind: GroundingRef['kind'];
  source_id: string;
  label: string;
};

/** A moderated v2 output plus how it is grounded. */
export type GroundedOutput<T> = {
  value: T;
  /** Built on an approved brand profile (false = generic copy, flagged in the UI). */
  grounded: boolean;
  /** Distinct refs cited by the kept variants, resolved to their sources. */
  refs: ResolvedGroundingRef[];
  warnings: string[];
  /** Variants removed because they used a banned word or rejected claim. */
  dropped: number;
};

export function contractIdForContentKind(kind: ContentContractKind): AiContractId {
  if (kind === 'alt') return 'content.alt_text';
  if (kind === 'hashtags') return 'content.hashtags';
  if (kind === 'inbox_reply') return 'inbox.reply';
  return 'content.variants';
}

export function allowedGroundingRefs(brand: BrandContext): string[] {
  return brand.usedApprovedProfile ? brand.groundingRefs.map((r) => r.ref) : [];
}

export function maxCharsForKind(kind: ContentContractKind, maxChars: number): number {
  if (kind === 'alt') return Math.min(ALT_TEXT_MAX_CHARS, maxChars);
  if (kind === 'inbox_reply') return Math.min(INBOX_REPLY_MAX_CHARS, maxChars);
  return maxChars;
}

/**
 * Per-call contract: the v2 content schema narrowed to this channel's limits,
 * the requested language and the refs present in this brand's context.
 */
export function buildContractFor(kind: ContentContractKind, ctx: GroundingContext) {
  const opts = contentContractOptions(
    ctx.limits,
    maxCharsForKind(kind, ctx.maxChars),
    ctx.variantCount,
    {
      language: ctx.language,
      allowedRefs: allowedGroundingRefs(ctx.brand),
      languageIgnore: [ctx.brand.brandName],
    },
  );
  const schema = contentGenerationSchemaV2(kind, opts);
  return {
    contractId: contractIdForContentKind(kind),
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    options: opts,
    schema,
    jsonSchema: () => toProviderJsonSchema(schema),
    parse: (raw: unknown) => parseAiOutput(schema, raw),
  };
}

function normalizeComparable(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function bannedMatches(text: string, brand: BrandContext): string[] {
  const haystack = normalizeComparable(text);
  return collectBannedPhrases(brand).filter((phrase) =>
    haystack.includes(normalizeComparable(phrase)),
  );
}

export function resolveGroundingRefs(
  refs: readonly string[],
  brand: BrandContext,
): ResolvedGroundingRef[] {
  const byRef = new Map(brand.groundingRefs.map((r) => [r.ref, r]));
  const out: ResolvedGroundingRef[] = [];
  for (const ref of new Set(refs)) {
    const hit = byRef.get(ref);
    if (hit) out.push({ ref, kind: hit.kind, source_id: hit.sourceId, label: hit.label });
  }
  return out;
}

/**
 * Drop variants that use a banned word or a rejected claim (never rewrite or trim
 * them). The caller refuses when nothing is left.
 */
export function moderateGroundedOutput(
  value: ContentGenerationV2,
  brand: BrandContext,
): GroundedOutput<ContentGenerationV2> {
  const warnings = [...value.warnings];
  const kept: ContentGenerationV2['variants'] = [];
  let dropped = 0;
  for (const variant of value.variants) {
    const matches = bannedMatches(variant.text, brand);
    if (matches.length) {
      dropped += 1;
      warnings.push(`banned_claim:${matches[0]}`);
      continue;
    }
    kept.push(variant);
  }
  const hashtags = value.hashtags
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
    .filter((tag) => !bannedMatches(tag, brand).length);
  return {
    value: { ...value, variants: kept, hashtags },
    grounded: brand.usedApprovedProfile,
    refs: resolveGroundingRefs(
      kept.flatMap((v) => v.groundingRefs),
      brand,
    ),
    warnings: [...new Set(warnings)],
    dropped,
  };
}

function clipTo(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function hashtagFor(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}_]/gu, '');
  return `#${cleaned || 'brand'}`;
}

/** Deterministic v2 output for the test adapter; always valid for `buildContractFor`. */
export function deterministicGroundedGeneration(input: {
  kind: ContentContractKind;
  ctx: GroundingContext;
  promptId: string;
  promptVersion: string;
  caption?: string;
}): ContentGenerationV2 {
  const { kind, ctx } = input;
  const brand = ctx.brand.brandName || 'Brand';
  const channel = ctx.limits.channel;
  const ar = ctx.language === 'ar';
  const max = maxCharsForKind(kind, ctx.maxChars);
  const tag = hashtagFor(brand);
  const rawCaption = input.caption?.trim();
  // Only echo the caption when it is already in the target language.
  const caption =
    rawCaption && matchesLanguage(rawCaption, ctx.language, [brand]) ? rawCaption : undefined;
  const ref = allowedGroundingRefs(ctx.brand)[0];
  const first =
    kind === 'alt'
      ? ar
        ? `وصف تجريبي لصورة ${brand} على ${channel}`
        : `Test alt text for ${brand} on ${channel}`
      : kind === 'hashtags'
        ? `${tag} #${channel}`
        : kind === 'inbox_reply'
          ? ar
            ? `شكراً لتواصلك مع ${brand}. يسعدنا مساعدتك.`
            : `Thanks for writing to ${brand}. We are happy to help.`
          : caption
            ? ar
              ? `${caption} من ${brand}.`
              : `${caption} from ${brand}.`
            : ar
              ? `فكرة تجريبية من ${brand} على ${channel}.`
              : `Test ${kind} from ${brand} on ${channel}.`;
  const second =
    kind === 'hashtags' ? `${tag}` : ar ? `${first} خيار آخر.` : `${first} Another option.`;
  const variants = [
    {
      text: clipTo(first, max),
      rationale: ar ? 'نسخة تجريبية أولى' : 'First deterministic test variant',
      factual: Boolean(ref) && kind !== 'hashtags',
      groundingRefs: ref && kind !== 'hashtags' ? [ref] : [],
    },
    {
      text: clipTo(second, max),
      rationale: ar ? 'نسخة تجريبية ثانية' : 'Second deterministic test variant',
      factual: false,
      groundingRefs: ref && kind !== 'hashtags' ? [ref] : [],
    },
  ];
  const hashtags =
    kind === 'alt' || kind === 'inbox_reply' || ctx.limits.hashtagMax === 0
      ? kind === 'hashtags'
        ? [tag]
        : []
      : [tag];
  return {
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    schemaVersion: AI_CONTRACT_SCHEMA_VERSION,
    language: ctx.language,
    sourceVersion: ctx.brand.profileVersionId ?? 'none',
    banner: AI_PROPOSAL_BANNER,
    variants,
    hashtags,
    warnings: [],
  };
}
