import { describe, expect, it } from 'vitest';
import { DEMO_GRAPH, DemoDataProvider } from '@oma/demo';
import {
  campaignNextAction,
  campaignProgress,
  campaignReviewState,
  filterCampaigns,
  groupCampaignsByStatus,
  strategyHref,
} from '../../../apps/web/src/lib/demo/stage3-campaigns';
import {
  buildMonthCells,
  filterContent,
  groupContentByDay,
  statusLabel,
} from '../../../apps/web/src/lib/demo/stage3-content';

describe('stage3 campaign filters/grouping', () => {
  it('filters by Organic track and groups needs-attention first', () => {
    const organic = filterCampaigns(
      DEMO_GRAPH.campaigns,
      {
        query: '',
        status: 'all',
        track: 'ORGANIC',
        strategyId: 'all',
        owner: 'all',
        startFrom: '',
        endTo: '',
      },
      'en',
    );
    expect(organic.every((c) => c.track === 'ORGANIC')).toBe(true);
    expect(organic.some((c) => c.id === 'demo-campaign-organic')).toBe(true);

    const groups = groupCampaignsByStatus(DEMO_GRAPH.campaigns);
    expect(groups[0]?.status).toBe('NEEDS_ATTENTION');
    expect(strategyHref('demo-brand-horizon', 'demo-strategy-q3')).toBe(
      '/app/brands/demo-brand-horizon/strategies/demo-strategy-q3',
    );
  });

  it('computes progress, review state, and next action from linked content', () => {
    const campaign = DEMO_GRAPH.campaigns.find((c) => c.id === 'demo-campaign-organic')!;
    const items = DEMO_GRAPH.contentItems.filter((c) => c.campaignId === campaign.id);
    expect(campaignProgress(campaign)).toBeGreaterThan(0);
    expect(campaignReviewState(items)).toBe('IN_REVIEW');
    expect(campaignNextAction(campaign, items, 'en')).toMatch(/review/i);
  });
});

describe('stage3 content calendar mapping', () => {
  it('groups scheduled items by day and builds overflow-capable month cells', () => {
    const byDay = groupContentByDay(DEMO_GRAPH.contentItems);
    expect(byDay.get('2026-09-12')?.some((i) => i.id === 'demo-content-reel')).toBe(true);
    const cells = buildMonthCells(2026, 8, 0);
    expect(cells).toHaveLength(42);
    expect(cells.some((c) => c.key === '2026-09-01' && c.inMonth)).toBe(true);
  });

  it('filters content by campaign and maps semantic status labels', () => {
    const filtered = filterContent(
      DEMO_GRAPH.contentItems,
      {
        query: '',
        campaignId: 'demo-campaign-organic',
        channel: 'all',
        contentType: 'all',
        status: 'all',
        review: 'all',
        assignee: 'all',
        dateFrom: '',
        dateTo: '',
      },
      'en',
    );
    expect(filtered.every((i) => i.campaignId === 'demo-campaign-organic')).toBe(true);
    expect(statusLabel('IN_REVIEW', 'en')).toBe('Needs review');
    expect(statusLabel('IN_REVIEW', 'ar')).toMatch(/مراجعة/);
  });
});

describe('stage3 demo relationships + mutations', () => {
  it('keeps strategy→campaign→content ids linked and supports create persistence in memory', () => {
    const provider = new DemoDataProvider();
    const journey = provider.getLinkedJourney();
    expect(journey.organicCampaign.strategyId).toBe(journey.strategy.id);
    expect(journey.contentPlan.every((c) => c.campaignId === journey.organicCampaign.id)).toBe(
      true,
    );

    const created = provider.createCampaign({
      name: { en: 'Stage3 Test Campaign', ar: 'حملة اختبار' },
      strategyId: journey.strategy.id,
      brandId: journey.brand.id,
      track: 'ORGANIC',
      owner: 'Test Owner',
      timeline: { start: '2026-09-20', end: '2026-10-20' },
      channels: ['Instagram'],
    });
    expect(provider.getCampaign(created.id)?.name.en).toBe('Stage3 Test Campaign');

    const content = provider.createContent({
      title: { en: 'Stage3 Test Post', ar: 'منشور اختبار' },
      campaignId: created.id,
      brandId: journey.brand.id,
      track: 'ORGANIC',
      channel: 'Instagram',
      contentType: 'POST',
      owner: 'Test Owner',
      scheduledAt: '2026-09-28T12:00:00+03:00',
    });
    expect(provider.contentCountByCampaign(created.id)).toBe(1);
    expect(provider.getContent(content.id)?.campaignId).toBe(created.id);
  });
});
