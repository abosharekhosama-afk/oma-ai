import { describe, expect, it } from 'vitest';
import {
  applyAcceptedInsightClaimToSections,
  bootstrapIdentitySectionsFromObservations,
  computeBrandIdentityCompleteness,
  reconcileIdentitySectionsFromInsights,
} from '@oma/domain';

describe('brand identity sections closure', () => {
  it('bootstraps overview and visual identity from crawl observations', () => {
    const obs = [
      {
        fieldKey: 'brand.name',
        valueJson: JSON.stringify('Acme Co'),
      },
      {
        fieldKey: 'brand.description',
        valueJson: JSON.stringify('We build tools.'),
      },
      {
        fieldKey: 'brand.colors',
        valueJson: JSON.stringify({ theme: ['#112233'] }),
      },
      {
        fieldKey: 'brand.logo',
        valueJson: JSON.stringify({
          favicon: 'https://acme.test/f.ico',
          urls: ['https://acme.test/logo.png'],
        }),
      },
    ];
    const boot = bootstrapIdentitySectionsFromObservations(obs);
    expect((boot.overview as { name: string }).name).toBe('Acme Co');
    const visual = boot.visual_identity as { colors: string[] };
    expect(visual.colors).toEqual(['#112233']);
    const completeness = computeBrandIdentityCompleteness({
      ...boot,
      tone: {},
      audiences: {},
      messaging: {},
    });
    expect(completeness.sections.visual_identity).toBe(true);
    expect(completeness.sections.overview).toBe(true);
  });

  it('merges structured logo insight into visual_identity', () => {
    const next = applyAcceptedInsightClaimToSections(
      {},
      'brand.logo',
      null,
      JSON.stringify({ favicon: 'https://x.test/f.ico', urls: ['https://x.test/l.png'] }),
    );
    const visual = next.visual_identity as { favicon: string; logos: string[] };
    expect(visual.favicon).toBe('https://x.test/f.ico');
    expect(visual.logos).toContain('https://x.test/l.png');
  });

  it('reconciles accepted narrative insights into sections', () => {
    const merged = reconcileIdentitySectionsFromInsights(
      { overview: {} },
      [
        {
          fieldKey: 'brand.tone',
          textValue: 'Calm and direct',
          valueJson: null,
          reviewStatus: 'ACCEPTED',
        },
        {
          fieldKey: 'brand.audiences',
          textValue: 'SMB marketers',
          valueJson: null,
          reviewStatus: 'PENDING',
        },
      ],
    );
    expect(merged.tone).toEqual({ summary: 'Calm and direct' });
    expect(merged.audiences).toBeUndefined();
    const completeness = computeBrandIdentityCompleteness(merged as Record<string, unknown>);
    expect(completeness.narrative_ready).toBe(false);
  });
});