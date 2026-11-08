import { describe, expect, it } from 'vitest';

import {
  buildChannelAnalyticsView,
  parseInsights,
  resolveChannelAnalyticsStatus,
} from '../../apps/api/src/content/channel-analytics';

const emptyRx = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };

function base(over: Partial<Parameters<typeof buildChannelAnalyticsView>[0]> = {}) {
  return buildChannelAnalyticsView({
    channel: 'instagram',
    isPublished: false,
    publishedAt: null,
    platformConnected: false,
    externalPostId: null,
    live: null,
    lastInsightsAt: null,
    omaLikes: 0,
    omaPublicComments: 0,
    omaCommentsTotal: 0,
    omaReactions: emptyRx,
    approvals: 0,
    contentId: 'post_abc',
    demo: false,
    ...over,
  });
}

describe('channel analytics builder', () => {
  it('does not invent views for an unpublished post', () => {
    const view = base();
    expect(view.status).toBe('not_published');
    expect(view.source).toBe('oma_local');
    expect(view.kpis.views).toBe(0);
    expect(view.plays.three_second).toBe(0);
    expect(view.organic_engagement.link_clicks).toBe(0);
  });

  it('keeps real workspace comments without fabricating reach', () => {
    const view = base({ omaPublicComments: 2, omaCommentsTotal: 3, omaLikes: 1 });
    expect(view.organic_engagement.comments).toBe(2);
    expect(view.organic_engagement.likes).toBe(1);
    expect(view.kpis.reach).toBe(0);
    expect(view.kpis.views).toBe(0);
  });

  it('uses live platform insights when present', () => {
    const view = base({
      channel: 'facebook',
      isPublished: true,
      platformConnected: true,
      pageStatus: 'CONNECTED',
      externalPostId: '123',
      live: {
        impressions: 1500,
        reach: 1100,
        views: 1500,
        likes: 40,
        comments: 6,
        shares: 3,
        fetchedAt: '2026-11-08T10:00:00.000Z',
      },
      lastInsightsAt: new Date('2026-11-08T10:00:00.000Z'),
    });
    expect(view.status).toBe('ready');
    expect(view.source).toBe('platform');
    expect(view.kpis).toEqual({ views: 1500, engagements: 49, reach: 1100 });
    expect(view.organic_engagement).toMatchObject({ likes: 40, comments: 6, shares: 3 });
    expect(view.plays.three_second).toBe(0);
    expect(view.insights_at).toBe('2026-11-08T10:00:00.000Z');
    expect(view.external_post_id).toBe('123');
  });

  it('reports no_data_yet instead of seeding fake numbers', () => {
    const view = base({
      isPublished: true,
      platformConnected: true,
      pageStatus: 'CONNECTED',
      externalPostId: 'ig_1',
      demo: false,
    });
    expect(view.status).toBe('no_data_yet');
    expect(view.source).toBe('oma_local');
    expect(view.kpis.views).toBe(0);
    expect(view.note.toLowerCase()).toContain('not returned insights');
  });

  it('keeps seed metrics only when demo mode is explicitly on', () => {
    const demo = base({
      isPublished: true,
      platformConnected: true,
      pageStatus: 'CONNECTED',
      externalPostId: 'ig_1',
      demo: true,
    });
    const live = base({
      isPublished: true,
      platformConnected: true,
      pageStatus: 'CONNECTED',
      externalPostId: 'ig_1',
      demo: false,
    });
    expect(demo.source).toBe('demo');
    expect(demo.status).toBe('ready');
    expect(demo.kpis.views).toBeGreaterThan(0);
    expect(live.kpis.views).toBe(0);
    expect(live.source).toBe('oma_local');
  });

  it('does not let demo metrics override live insights', () => {
    const view = base({
      isPublished: true,
      platformConnected: true,
      pageStatus: 'CONNECTED',
      externalPostId: 'ig_1',
      demo: true,
      live: { views: 9, likes: 2, fetchedAt: '2026-11-08T09:00:00.000Z' },
    });
    expect(view.source).toBe('platform');
    expect(view.kpis.views).toBe(9);
    expect(view.organic_engagement.likes).toBe(2);
  });

  it('marks WhatsApp and YouTube as unsupported after publish', () => {
    expect(base({ channel: 'whatsapp', isPublished: true, platformConnected: true }).status).toBe(
      'unsupported',
    );
    expect(base({ channel: 'youtube', isPublished: true }).status).toBe('unsupported');
  });

  it('resolves connection and missing-id states', () => {
    expect(
      resolveChannelAnalyticsStatus({
        isPublished: true,
        platformConnected: false,
        hasLiveInsights: false,
      }),
    ).toBe('not_connected');
    expect(
      resolveChannelAnalyticsStatus({
        isPublished: true,
        platformConnected: true,
        pageStatus: 'CONNECTED',
        externalPostId: null,
        hasLiveInsights: false,
      }),
    ).toBe('no_external_id');
    expect(
      resolveChannelAnalyticsStatus({
        isPublished: true,
        platformConnected: true,
        pageStatus: 'NEEDS_REAUTH',
        externalPostId: 'x',
        hasLiveInsights: true,
      }),
    ).toBe('not_connected');
  });

  it('parses stored insight payloads and ignores invalid json', () => {
    expect(parseInsights('{"views": 12, "likes": 4, "fetchedAt": "t"}')).toMatchObject({
      views: 12,
      likes: 4,
      fetchedAt: 't',
    });
    expect(parseInsights('nope')).toBeNull();
    expect(parseInsights(null)).toBeNull();
  });
});
