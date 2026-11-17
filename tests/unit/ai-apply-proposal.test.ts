import { describe, expect, it } from 'vitest';
import {
  AI_PROPOSAL_BANNER,
  applyAcceptedInsightToSections,
  insightWritesFromProposal,
  mergeAiSections,
  shouldSkipApprovedProfile,
  visualIdentityFromObservations,
} from '@oma/domain';

const proposal = {
  promptId: 'oma.brand_profile_synthesis',
  promptVersion: '2',
  schemaVersion: '1' as const,
  language: 'en' as const,
  sourceVersion: 'v1',
  evidenceRefs: ['e1'],
  items: [
    {
      field: 'brand.tone',
      value: 'Calm and direct',
      kind: 'inference' as const,
      confidence: 0.6,
      evidenceRefs: ['e1', 'missing'],
    },
    {
      field: 'recommendation',
      value: 'skip me',
      kind: 'proposal' as const,
      evidenceRefs: ['e1'],
    },
  ],
  banner: AI_PROPOSAL_BANNER,
};

describe('apply brand proposal', () => {
  it('writes AI claims only for brand or catalog fields and cites known evidence', () => {
    const writes = insightWritesFromProposal(proposal, new Set(['e1']));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.fieldKey).toBe('brand.tone');
    expect(writes[0]?.createdBy).toBe('AI');
    expect(writes[0]?.evidenceId).toBe('e1');
    expect(writes[0]?.confidence).toBe(0.6);
    expect(writes[0]?.discoveryTier).toBe('DISCOVER_WHEN_AVAILABLE');
  });

  it('merges tone, audiences, messaging, and observed visual identity', () => {
    const visual = visualIdentityFromObservations([
      {
        fieldKey: 'brand.colors',
        valueJson: JSON.stringify({ theme: ['#112233'] }),
      },
      {
        fieldKey: 'brand.logo',
        valueJson: JSON.stringify({
          urls: ['https://acme.test/logo.png'],
          favicon: 'https://acme.test/favicon.ico',
        }),
      },
    ]);
    const sections = mergeAiSections({ overview: {} }, proposal, { visualIdentity: visual });
    expect(sections.tone).toEqual({ summary: 'Calm and direct' });
    expect((sections.visual_identity as { colors: string[] }).colors).toEqual(['#112233']);
    expect(shouldSkipApprovedProfile('APPROVED')).toBe(true);
    expect(shouldSkipApprovedProfile('NEEDS_REVIEW')).toBe(false);
  });

  it('mergeAiSections applies name, contact, and social proposal fields', () => {
    const rich = {
      ...proposal,
      items: [
        ...proposal.items,
        { field: 'brand.name', value: 'Acme Co', kind: 'fact' as const, evidenceRefs: ['e1'] },
        {
          field: 'brand.contact',
          value: 'hello@acme.test',
          kind: 'fact' as const,
          evidenceRefs: ['e1'],
        },
        {
          field: 'brand.social',
          value: '@acme',
          kind: 'inference' as const,
          evidenceRefs: ['e1'],
        },
      ],
    };
    const sections = mergeAiSections({}, rich);
    expect((sections.overview as { name: string }).name).toBe('Acme Co');
    expect((sections.contact as { summary: string }).summary).toBe('hello@acme.test');
    expect((sections.social as { summary: string }).summary).toBe('@acme');
  });

  it('applyAcceptedInsightToSections updates overview on accept path', () => {
    const next = applyAcceptedInsightToSections({}, 'brand.description', 'Grounded copy');
    expect((next.overview as { description: string }).description).toBe('Grounded copy');
  });
});
