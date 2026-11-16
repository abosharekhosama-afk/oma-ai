import { z } from 'zod';
import type { ChannelLimits, ContentGenerationKind } from '../generation';
import { proposalEnvelope, contractText } from './common';

export type ContentContractKind = ContentGenerationKind | 'inbox_reply';

export type ContentContractOptions = {
  /** Max characters per variant (from the channel and requested length). */
  maxChars: number;
  /** Max hashtags for the channel. */
  hashtagMax: number;
  /** Requested number of variants (clamped per kind). */
  variantCount?: number;
};

export const ALT_TEXT_MAX_CHARS = 250;
export const INBOX_REPLY_MAX_VARIANTS = 3;
export const CONTENT_MAX_VARIANTS = 5;
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
  const hashtagMax = Math.max(0, opts.hashtagMax);
  const hashtags =
    kind === 'alt' || kind === 'inbox_reply'
      ? z.array(hashtag).max(0)
      : kind === 'hashtags'
        ? z.array(hashtag).min(1).max(Math.max(1, hashtagMax))
        : z.array(hashtag).max(hashtagMax);
  return z.strictObject({
    ...proposalEnvelope,
    variants: z
      .array(z.strictObject({ text: variantText, rationale }))
      .min(bounds.min)
      .max(bounds.max),
    hashtags,
    warnings,
  });
}

export type ContentGenerationV2 = z.infer<ReturnType<typeof contentGenerationSchemaV2>>;

export function contentContractOptions(
  limits: Pick<ChannelLimits, 'hashtagMax'>,
  maxChars: number,
  variantCount?: number,
): ContentContractOptions {
  return { maxChars, hashtagMax: limits.hashtagMax, variantCount };
}

/** Widest bounds, used for the static registry entry and provider schema shape tests. */
export const CONTENT_DEFAULT_OPTIONS: ContentContractOptions = {
  maxChars: 5000,
  hashtagMax: 30,
  variantCount: CONTENT_MAX_VARIANTS,
};
