import { describe, expect, it } from 'vitest';
import {
  AI_PROPOSAL_BANNER,
  applyGenerationModeration,
  buildBrandContext,
  channelLimits,
  kindToUseCase,
  moderateGeneratedText,
} from '@oma/domain';

describe('generation moderation and routing', () => {
  const brand = buildBrandContext({
    tenantId: 't1',
    brandId: 'b1',
    brandName: 'Acme',
    profile: {
      id: 'p1',
      tenantId: 't1',
      brandId: 'b1',
      status: 'APPROVED',
      sectionsJson: JSON.stringify({ banned_words: ['miracle cure'] }),
    },
    claims: [{ fieldKey: 'brand.messaging', text: 'guaranteed results', reviewStatus: 'REJECTED' }],
  });

  it('flags banned words and rejected claims', () => {
    expect(moderateGeneratedText('Try our miracle cure today', brand).ok).toBe(false);
    expect(moderateGeneratedText('We promise guaranteed results', brand).ok).toBe(false);
    expect(moderateGeneratedText('Fresh juice for the week', brand).ok).toBe(true);
  });

  it('trims captions to platform limits and drops banned variants when possible', () => {
    const limits = channelLimits('x');
    const result = applyGenerationModeration(
      {
        promptId: 'oma.caption_generation',
        promptVersion: '1',
        schemaVersion: '1',
        language: 'en',
        sourceVersion: 'p1',
        banner: AI_PROPOSAL_BANNER,
        variants: [
          { text: 'a'.repeat(400), rationale: 'long' },
          { text: 'Our miracle cure', rationale: 'bad' },
          { text: 'Sip fresh juice today', rationale: 'ok' },
        ],
        hashtags: ['Fresh', '#Juice', '#TooMany', '#Four'],
        warnings: [],
      },
      brand,
      limits,
    );
    expect(result.variants.every((item) => item.text.length <= limits.captionMax)).toBe(true);
    expect(result.variants.some((item) => item.text.includes('Sip fresh juice'))).toBe(true);
    expect(result.hashtags.length).toBeLessThanOrEqual(limits.hashtagMax);
  });

  it('maps composer kinds to luna use cases', () => {
    expect(kindToUseCase('caption')).toBe('caption_generation');
    expect(kindToUseCase('rewrite')).toBe('caption_rewrite');
    expect(kindToUseCase('alt')).toBe('alt_text');
    expect(kindToUseCase('idea')).toBe('content_ideas');
    expect(kindToUseCase('hashtags')).toBe('hashtag_suggestion');
  });
});
