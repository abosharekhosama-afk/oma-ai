import { z } from 'zod';
import type { ChannelLimits, ContentGenerationKind } from '../generation';
import { matchesLanguage, type AiOutputLanguage } from '../language';
import { proposalEnvelope, contractText, contractLanguage } from './common';

export type ContentContractKind = ContentGenerationKind | 'inbox_reply';

export type ContentContractOptions = {
  /** Max characters per variant (from the channel and requested length). */
  maxChars: number;
  /** Max hashtags for the channel. */
  hashtagMax: number;
  /** Requested number of variants (clamped per kind). */
  variantCount?: number;
  /** Required output language. When set, `language` must match and text is script-checked. */
  language?: AiOutputLanguage;
  /** Grounding ref ids the model may cite. When set, any other id is rejected. */
  allowedRefs?: readonly string[];
  /** Terms ignored by the language check (brand name, product names). */
  languageIgnore?: readonly string[];
};

export const ALT_TEXT_MAX_CHARS = 250;
export const INBOX_REPLY_MAX_VARIANTS = 3;
export const CONTENT_MAX_VARIANTS = 5;
export const MAX_GROUNDING_REFS = 8;
/** Money amounts and percentages: stating one needs a grounding ref. */
export const FIGURE_PATTERN =
  /[\d٠-٩]+(?:[.,][\d٠-٩]+)?\s?%|[$€£]\s?[\d٠-٩]|[\d٠-٩]+\s?(?:usd|eur|sar|aed|ils|omr|qar|kwd|bhd|jod|egp|ريال|دولار|درهم|شيكل|دينار|جنيه)/iu;
export const HASHTAG_PATTERN = /^#?[\p{L}\p{N}_]{1,100}$/u;

const rationale = z.string().trim().max(300);
const warnings = z.array(z.string().trim().max(200)).max(10);
const hashtag = z.string().trim().regex(HASHTAG_PATTERN, 'must be a single hashtag');

function variantBounds(kind: ContentContractKind, requested?: number) {
  if (kind === 'inbox_reply') return { min: 1, max: INBOX_REPLY_MAX_VARIANTS };
  if (kind === 'alt' || kind === 'hashtags') return { min: 1, max: 3 };
  const n = Math.min(CONTENT_MAX_VARIANTS, Math.max(2, requested ?? 3));
  return { min: Math.min(2, n), max: n };
}

/**
 * Strict v2 contract for one content kind. Limits come from the channel, so the
 * schema itself rejects an over-long caption instead of trimming it afterwards.
 */
export function contentGenerationSchemaV2(kind: ContentContractKind, opts: ContentContractOptions) {
  const bounds = variantBounds(kind, opts.variantCount);
  const maxChars = Math.max(
    1,
    kind === 'alt' ? Math.min(ALT_TEXT_MAX_CHARS, opts.maxChars) : opts.maxChars,
  );
  const variantText =
    kind === 'alt'
      ? contractText(maxChars).refine((v) => !v.includes('#'), 'alt text must not contain hashtags')
      : contractText(maxChars);
  const allowed = opts.allowedRefs ? new Set(opts.allowedRefs) : null;
  const variant = z
    .strictObject({
      text: variantText,
      rationale,
      /** True when the text states brand-specific facts (products, prices, numbers, policies). */
      factual: z.boolean(),
      groundingRefs: z.array(z.string().trim().min(1).max(40)).max(MAX_GROUNDING_REFS),
    })
    .superRefine((v, ctx) => {
      for (const [i, ref] of v.groundingRefs.entries()) {
        if (allowed && !allowed.has(ref)) {
          ctx.addIssue({
            code: 'custom',
            path: ['groundingRefs', i],
            message: allowed.size
              ? `unknown grounding ref "${ref}"; use only ids shown in the brand context`
              : `unknown grounding ref "${ref}"; no brand facts are available, so cite none`,
          });
        }
      }
      if (v.factual && v.groundingRefs.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['groundingRefs'],
          message: 'a factual variant must cite at least one grounding ref, or drop the fact',
        });
      }
      if (kind !== 'hashtags' && v.groundingRefs.length === 0 && FIGURE_PATTERN.test(v.text)) {
        ctx.addIssue({
          code: 'custom',
          path: ['text'],
          message: 'prices and percentages need a grounding ref; remove the figure or cite it',
        });
      }
      if (
        opts.language &&
        kind !== 'hashtags' &&
        !matchesLanguage(v.text, opts.language, opts.languageIgnore ?? [])
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['text'],
          message: `text must be written in ${opts.language === 'ar' ? 'Arabic' : 'English'}`,
        });
      }
    });
  const hashtagMax = Math.max(0, opts.hashtagMax);
  const hashtags =
    kind === 'alt' || kind === 'inbox_reply'
      ? z.array(hashtag).max(0)
      : kind === 'hashtags'
        ? z.array(hashtag).min(1).max(Math.max(1, hashtagMax))
        : z.array(hashtag).max(hashtagMax);
  return z.strictObject({
    ...proposalEnvelope,
    language: opts.language ? z.literal(opts.language) : contractLanguage,
    variants: z.array(variant).min(bounds.min).max(bounds.max),
    hashtags,
    warnings,
  });
}

export type ContentGenerationV2 = z.infer<ReturnType<typeof contentGenerationSchemaV2>>;

export function contentContractOptions(
  limits: Pick<ChannelLimits, 'hashtagMax'>,
  maxChars: number,
  variantCount?: number,
  extra: Pick<ContentContractOptions, 'language' | 'allowedRefs' | 'languageIgnore'> = {},
): ContentContractOptions {
  return { maxChars, hashtagMax: limits.hashtagMax, variantCount, ...extra };
}

/** Widest bounds, used for the static registry entry and provider schema shape tests. */
export const CONTENT_DEFAULT_OPTIONS: ContentContractOptions = {
  maxChars: 5000,
  hashtagMax: 30,
  variantCount: CONTENT_MAX_VARIANTS,
};
