import { describe, expect, it } from 'vitest';
import { buildPlanWorkRequestDrafts } from './plan-work-requests';

describe('buildPlanWorkRequestDrafts', () => {
  it('creates organic requests per pillar with brief fields', () => {
    const drafts = buildPlanWorkRequestDrafts({
      strategyName: 'Q3 Growth',
      foundation: {
        goals: [{ value: 'Increase awareness' }],
        keyMessages: [{ value: 'Quality first' }],
        positioning: { value: 'Trusted partner' },
      },
      organicEnabled: true,
      paidEnabled: false,
      organic: {
        pillars: ['Education', 'Community'],
        channels: ['Instagram'],
        formats: ['Reel'],
      },
      paid: null,
      audiences: [{ name: 'SMB owners', description: 'Regional SMEs' }],
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.plan_source_key).toBe('organic:pillar:0');
    expect(drafts[0]?.brief.audience.en).toContain('SME');
    expect(drafts[0]?.channels).toEqual(['Instagram']);
  });

  it('creates paid objectives when paid track is enabled', () => {
    const drafts = buildPlanWorkRequestDrafts({
      strategyName: 'Launch',
      foundation: { goals: [{ value: 'Leads' }] },
      organicEnabled: false,
      paidEnabled: true,
      organic: null,
      paid: {
        campaign_objectives: ['Retargeting'],
        formats: ['Static'],
        offer_angle: 'Free audit',
      },
      audiences: [{ name: 'Buyers' }],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.track).toBe('paid');
    expect(drafts[0]?.plan_source_key).toBe('paid:objective:0');
  });
});
