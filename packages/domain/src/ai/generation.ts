import { z } from 'zod';
import { AI_PROPOSAL_BANNER } from './proposal';
import type { BrandContext } from './brand-context';

export const CONTENT_GENERATION_KINDS = ['caption', 'rewrite', 'alt', 'idea', 'hashtags'] as const;
export type ContentGenerationKind = (typeof CONTENT_GENERATION_KINDS)[number];

export const CONTENT_LENGTHS = ['short', 'medium', 'long'] as const;
export type ContentLength = (typeof CONTENT_LENGTHS)[number];

export type ChannelLimits = {
  channel: string;
  captionMax: number;
  hashtagMax: number;
  recommendedHashtags: number;
};

const LIMITS: Record<string, Omit<ChannelLimits, 'channel'>> = {
  instagram: { captionMax: 2200, hashtagMax: 30, recommendedHashtags: 12 },
  facebook: { captionMax: 63206, hashtagMax: 10, recommendedHashtags: 3 },
  x: { captionMax: 280, hashtagMax: 3, recommendedHashtags: 2 },
  twitter: { captionMax: 280, hashtagMax: 3, recommendedHashtags: 2 },
  tiktok: { captionMax: 2200, hashtagMax: 8, recommendedHashtags: 4 },
  linkedin: { captionMax: 3000, hashtagMax: 5, recommendedHashtags: 3 },
  youtube: { captionMax: 5000, hashtagMax: 15, recommendedHashtags: 5 },
  threads: { captionMax: 500, hashtagMax: 10, recommendedHashtags: 3 },
  whatsapp: { captionMax: 1024, hashtagMax: 0, recommendedHashtags: 0 },
  snapchat: { captionMax: 80, hashtagMax: 0, recommendedHashtags: 0 },
  pinterest: { captionMax: 500, hashtagMax: 20, recommendedHashtags: 8 },
};

export function normalizeChannel(channel?: string | null): string {
  const raw = (channel ?? 'instagram').split(',')[0]?.trim().toLowerCase() || 'instagram';
  if (raw === 'twitter' || raw === 'x.com') return 'x';
  if (raw === 'ig') return 'instagram';
  if (raw === 'fb') return 'facebook';
  if (raw === 'li') return 'linkedin';
  if (raw === 'yt') return 'youtube';
  return raw;
}

export function channelLimits(channel?: string | null): ChannelLimits {
  const key = normalizeChannel(channel);
  const limits = LIMITS[key] ?? { captionMax: 2200, hashtagMax: 10, recommendedHashtags: 5 };
  return { channel: key, ...limits };
}

export function lengthBudget(length: ContentLength | undefined, limits: ChannelLimits): number {
  if (length === 'short')
    return Math.min(limits.captionMax, Math.max(80, Math.round(limits.captionMax * 0.25)));
  if (length === 'long') return limits.captionMax;
  return Math.min(limits.captionMax, Math.max(160, Math.round(limits.captionMax * 0.6)));
}

export const generationVariantSchema = z.object({
  text: z.string().min(1),
  rationale: z.string().default(''),
});

export const contentGenerationSchema = z.object({
  promptId: z.string().min(1),
  promptVersion: z.string().min(1),
  schemaVersion: z.literal('1'),
  language: z.enum(['en', 'ar']),
  sourceVersion: z.string().min(1),
  banner: z.literal(AI_PROPOSAL_BANNER),
  variants: z.array(generationVariantSchema).min(1),
  hashtags: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type ContentGenerationResult = z.infer<typeof contentGenerationSchema>;

export function validateContentGeneration(
  input: unknown,
): { ok: true; result: ContentGenerationResult } | { ok: false; code: 'SCHEMA_INVALID' } {
  const parsed = contentGenerationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'SCHEMA_INVALID' };
  return { ok: true, result: parsed.data };
}

/** Strict JSON Schema for OpenAI Structured Outputs. */
export function contentGenerationJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'promptId',
      'promptVersion',
      'schemaVersion',
      'language',
      'sourceVersion',
      'banner',
      'variants',
      'hashtags',
      'warnings',
    ],
    properties: {
      promptId: { type: 'string' },
      promptVersion: { type: 'string' },
      schemaVersion: { type: 'string', enum: ['1'] },
      language: { type: 'string', enum: ['en', 'ar'] },
      sourceVersion: { type: 'string' },
      banner: { type: 'string', enum: [AI_PROPOSAL_BANNER] },
      variants: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'rationale'],
          properties: {
            text: { type: 'string' },
            rationale: { type: 'string' },
          },
        },
      },
      hashtags: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  };
}

export function kindToUseCase(
  kind: ContentGenerationKind,
): 'caption_generation' | 'caption_rewrite' | 'alt_text' | 'content_ideas' | 'hashtag_suggestion' {
  switch (kind) {
    case 'rewrite':
      return 'caption_rewrite';
    case 'alt':
      return 'alt_text';
    case 'idea':
      return 'content_ideas';
    case 'hashtags':
      return 'hashtag_suggestion';
    default:
      return 'caption_generation';
  }
}

function normalizeComparable(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function collectBannedPhrases(context: BrandContext): string[] {
  const phrases = [
    ...context.bannedWords,
    ...context.dontClaims.map((claim) => claim.replace(/^[^:]+:\s*/, '')),
  ]
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
  return [...new Set(phrases)];
}

export function moderateGeneratedText(
  text: string,
  context: BrandContext,
): { ok: true } | { ok: false; matches: string[] } {
  const haystack = normalizeComparable(text);
  const matches = collectBannedPhrases(context).filter((phrase) =>
    haystack.includes(normalizeComparable(phrase)),
  );
  return matches.length ? { ok: false, matches } : { ok: true };
}

export function applyGenerationModeration(
  result: ContentGenerationResult,
  context: BrandContext,
  limits: ChannelLimits,
): ContentGenerationResult {
  const warnings = [...result.warnings];
  const variants = result.variants.map((variant) => {
    let text = variant.text.trim();
    if (text.length > limits.captionMax) {
      text = `${text.slice(0, Math.max(0, limits.captionMax - 1))}…`;
      warnings.push(`trimmed_to_${limits.captionMax}`);
    }
    const banned = moderateGeneratedText(text, context);
    if (!banned.ok) {
      warnings.push(`banned_claim:${banned.matches[0]}`);
    }
    return { ...variant, text };
  });
  const hashtags = result.hashtags
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '')}`))
    .filter((tag) => tag.length > 1)
    .slice(0, limits.hashtagMax);
  const clean = variants.filter((variant) => moderateGeneratedText(variant.text, context).ok);
  return {
    ...result,
    variants: (clean.length ? clean : variants).slice(0, 5),
    hashtags,
    warnings: [...new Set(warnings)],
  };
}

export function deterministicGeneration(input: {
  kind: ContentGenerationKind | 'inbox_reply';
  language: 'en' | 'ar';
  sourceVersion: string;
  brandName: string;
  channel?: string;
  caption?: string;
}): ContentGenerationResult {
  const brand = input.brandName || 'Brand';
  const channel = normalizeChannel(input.channel);
  const ar = input.language === 'ar';
  const promptId = `test.${input.kind}`;
  const caption = input.caption?.trim();
  const first =
    input.kind === 'alt'
      ? ar
        ? `وصف تجريبي لصورة ${brand} على ${channel}`
        : `Test alt text for ${brand} on ${channel}`
      : input.kind === 'hashtags'
        ? `#${brand.replace(/\s+/g, '')} #${channel}`
        : input.kind === 'inbox_reply'
          ? ar
            ? `شكراً لتواصلك مع ${brand}. يسعدنا مساعدتك.`
            : `Thanks for writing to ${brand}. We are happy to help.`
          : caption
            ? ar
              ? `${caption} — من ${brand}.`
              : `${caption} — from ${brand}.`
            : ar
              ? `فكرة تجريبية من ${brand} على ${channel}.`
              : `Test ${input.kind} from ${brand} on ${channel}.`;
  return {
    promptId,
    promptVersion: 'test-1',
    schemaVersion: '1',
    language: input.language,
    sourceVersion: input.sourceVersion,
    banner: AI_PROPOSAL_BANNER,
    variants: [
      { text: first, rationale: ar ? 'نسخة تجريبية أولى' : 'First deterministic test variant' },
      {
        text: ar ? `${first} خيار آخر.` : `${first} Another option.`,
        rationale: ar ? 'نسخة تجريبية ثانية' : 'Second deterministic test variant',
      },
    ],
    hashtags: [`#${brand.replace(/\s+/g, '')}`],
    warnings: [],
  };
}
