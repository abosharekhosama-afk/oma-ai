import { describe, expect, it } from 'vitest';
import { DEMO_GRAPH, DemoDataProvider } from '@oma/demo';
import {
  campaignFilterChips,
  campaignNextAction,
  campaignProgress,
  campaignReviewState,
  campaignScheduleReadiness,
  filterCampaigns,
  groupCampaignsByStatus,
  strategyHref,
} from '../../../apps/web/src/lib/demo/stage3-campaigns';
import {
  buildMonthCells,
  commentsForContent,
  filterContent,
  groupContentByDay,
  sortContent,
  splitCellItems,
  statusLabel,
} from '../../../apps/web/src/lib/demo/stage3-content';
import {
  isLocalDemoAsset,
  P3_MEDIA,
  previewAssetForType,
} from '../../../apps/web/src/lib/demo/demo-media';
import { isContentViewMode } from '../../../apps/web/src/lib/demo/demo-view-pref';

describe('stage3 campaign filters/grouping', () => {
  it('filters by Organic track and groups needs-attention first', () => {
    const organic = filterCampaigns(
      DEMO_GRAPH.campaigns,
      {
        query: '',
        brandId: 'all',
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

  it('filters by brand and emits named chips', () => {
    const branded = filterCampaigns(
      DEMO_GRAPH.campaigns,
      {
        query: '',
        brandId: 'demo-brand-horizon',
        status: 'all',
        track: 'all',
        strategyId: 'all',
        owner: 'all',
        startFrom: '',
        endTo: '',
      },
      'en',
    );
    expect(branded.every((c) => c.brandId === 'demo-brand-horizon')).toBe(true);
    const chips = campaignFilterChips(
      {
        query: 'summer',
        brandId: 'demo-brand-horizon',
        status: 'all',
        track: 'ORGANIC',
        strategyId: 'all',
        owner: 'all',
        startFrom: '',
        endTo: '',
      },
      {
        brand: () => 'Horizon',
        status: (id) => id,
        track: () => 'Organic',
        strategy: (id) => id,
      },
    );
    expect(chips.map((c) => c.id)).toEqual(['query', 'brandId', 'track']);
  });

  it('computes progress, review state, readiness, and next action from linked content', () => {
    const campaign = DEMO_GRAPH.campaigns.find((c) => c.id === 'demo-campaign-organic')!;
    const items = DEMO_GRAPH.contentItems.filter((c) => c.campaignId === campaign.id);
    expect(campaignProgress(campaign)).toBeGreaterThan(0);
    expect(campaignReviewState(items)).toBe('IN_REVIEW');
    expect(campaignScheduleReadiness(items)).toBe('blocked');
    expect(campaignNextAction(campaign, items, 'en')).toMatch(/review/i);
  });
});

describe('stage3 content calendar mapping', () => {
  it('groups scheduled items by day and builds overflow-capable month cells', () => {
    const byDay = groupContentByDay(DEMO_GRAPH.contentItems);
    const oct7 = byDay.get('2026-10-07') ?? [];
    expect(oct7.some((i) => i.id === 'demo-content-reel')).toBe(true);
    expect(oct7.length).toBeGreaterThanOrEqual(3);
    const { visible, extra } = splitCellItems(oct7, 2);
    expect(visible).toHaveLength(2);
    expect(extra).toBeGreaterThan(0);
    const cells = buildMonthCells(2026, 9, 0);
    expect(cells).toHaveLength(42);
    expect(cells.some((c) => c.key === '2026-10-01' && c.inMonth)).toBe(true);
  });

  it('filters content by campaign and brand and maps semantic status labels', () => {
    const filtered = filterContent(
      DEMO_GRAPH.contentItems,
      {
        query: '',
        campaignId: 'demo-campaign-organic',
        brandId: 'all',
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

  it('sorts list rows and maps comments from linked deliverables', () => {
    const sorted = sortContent(
      DEMO_GRAPH.contentItems,
      'title',
      'asc',
      'en',
      (id) => DEMO_GRAPH.campaigns.find((c) => c.id === id)?.name.en ?? id,
    );
    const titles = sorted.map((i) => i.title.en);
    expect([...titles].sort((a, b) => a.localeCompare(b))).toEqual(titles);
    const comments = commentsForContent(
      DEMO_GRAPH.tasks,
      DEMO_GRAPH.deliverables,
      'demo-content-carousel',
    );
    expect(comments.length).toBeGreaterThan(0);
    expect(comments[0]?.author).toBeTruthy();
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
    expect(provider.contentCountByCampaign(journey.organicCampaign.id)).toBeGreaterThan(0);

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
    expect(isLocalDemoAsset(content.previewAsset)).toBe(true);
  });
});

describe('P3 Planable media and view helpers', () => {
  it('maps content types to local P3 fixtures without remote hosts', () => {
    expect(previewAssetForType('STORY')).toBe(P3_MEDIA.story);
    expect(previewAssetForType('REEL')).toBe(P3_MEDIA.video);
    expect(previewAssetForType('POST')).toBe(P3_MEDIA.product);
    for (const src of Object.values(P3_MEDIA)) {
      expect(isLocalDemoAsset(src)).toBe(true);
      expect(src.startsWith('http')).toBe(false);
    }
  });

  it('accepts calendar/feed/grid/list view modes', () => {
    expect(isContentViewMode('feed')).toBe(true);
    expect(isContentViewMode('kanban')).toBe(false);
  });
});
