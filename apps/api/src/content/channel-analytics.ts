import { isDemoModeEnabled } from '@oma/demo';

export type ChannelAnalyticsStatus =
  'not_published' | 'not_connected' | 'no_external_id' | 'no_data_yet' | 'unsupported' | 'ready';

export type ChannelAnalyticsSource = 'oma_local' | 'platform' | 'demo';

export type ParsedInsights = {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  fetchedAt?: string;
};

export function parseInsights(raw: string | null | undefined): ParsedInsights | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const num = (k: string): number | undefined => {
      const n = v[k];
      return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
    };
    return {
      impressions: num('impressions'),
      reach: num('reach'),
      likes: num('likes'),
      comments: num('comments'),
      shares: num('shares'),
      views: num('views'),
      fetchedAt: typeof v.fetchedAt === 'string' ? v.fetchedAt : undefined,
    };
  } catch {
    return null;
  }
}

const NOTES: Record<ChannelAnalyticsStatus, string> = {
  not_published: 'This post has not been published to this channel yet.',
  not_connected: 'The social account for this channel is not connected.',
  no_external_id:
    'Published, but the platform post ID is not stored yet, so insights cannot be fetched.',
  no_data_yet:
    'The post is live on this channel, but the platform has not returned insights yet. They usually appear a few minutes after publishing.',
  unsupported: 'This channel does not provide per-post analytics.',
  ready: 'Live metrics from the connected platform, plus workspace comments and reactions.',
};

const DEMO_NOTE = 'Sample demo metrics. Not live platform data.';

function num(n: number | undefined, fallback = 0) {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

/** Channels we do not (or cannot) fetch per-post insights for. */
export function channelInsightsUnsupported(channel: string): boolean {
  const c = channel.trim().toLowerCase();
  return c === 'whatsapp' || c.includes('youtube') || c === 'yt';
}

export function resolveChannelAnalyticsStatus(input: {
  isPublished: boolean;
  platformConnected: boolean;
  pageStatus?: string | null;
  externalPostId?: string | null;
  hasLiveInsights: boolean;
  unsupported?: boolean;
}): ChannelAnalyticsStatus {
  if (!input.isPublished) return 'not_published';
  if (input.unsupported) return 'unsupported';
  if (!input.platformConnected || (input.pageStatus && input.pageStatus !== 'CONNECTED')) {
    return 'not_connected';
  }
  if (!input.externalPostId) return 'no_external_id';
  if (!input.hasLiveInsights) return 'no_data_yet';
  return 'ready';
}

export function buildChannelAnalyticsView(input: {
  channel: string;
  isPublished: boolean;
  publishedAt: Date | null;
  platformConnected: boolean;
  pageStatus?: string | null;
  externalPostId?: string | null;
  live: ParsedInsights | null;
  lastInsightsAt: Date | null;
  omaLikes: number;
  omaPublicComments: number;
  omaCommentsTotal: number;
  omaReactions: {
    like: number;
    love: number;
    haha: number;
    wow: number;
    sad: number;
    angry: number;
  };
  approvals: number;
  contentId: string;
  /** Override process env — tests pass this explicitly. */
  demo?: boolean;
}) {
  const demo = input.demo ?? isDemoModeEnabled(process.env);
  const unsupported = channelInsightsUnsupported(input.channel);
  const status = resolveChannelAnalyticsStatus({
    isPublished: input.isPublished,
    platformConnected: input.platformConnected,
    pageStatus: input.pageStatus,
    externalPostId: input.externalPostId,
    hasLiveInsights: Boolean(input.live),
    unsupported,
  });

  const useDemo = demo && !input.live && input.isPublished && !unsupported;

  let views = num(input.live?.views ?? input.live?.impressions);
  let reach = num(input.live?.reach);
  let impressions = num(input.live?.impressions ?? input.live?.views);
  let likes = input.live ? num(input.live.likes) : input.omaLikes;
  let comments = input.live ? num(input.live.comments) : input.omaPublicComments;
  let shares = num(input.live?.shares);

  let linkClicks = 0;
  let otherClicks = 0;
  let profileClicks = 0;
  let plays3s = 0;
  let plays1m = 0;
  let avgPlay = 0;
  const rx = { ...input.omaReactions };

  if (useDemo) {
    const seed =
      input.contentId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) +
      input.channel.length * 17;
    views = 640 + (seed % 900);
    likes = Math.max(input.omaLikes, 18 + (seed % 120));
    comments = Math.max(input.omaPublicComments, 4 + (seed % 28));
    shares = 3 + (seed % 22);
    reach = Math.round(views * 0.92);
    impressions = views;
    otherClicks = Math.round(views * 0.12);
    linkClicks = Math.round(shares * 0.5);
    profileClicks = Math.max(2, Math.round(likes * 0.08));
    plays3s = Math.round(views * 0.62);
    plays1m = Math.round(views * 0.18);
    avgPlay = 14;
    if (rx.like + rx.love + rx.haha + rx.wow + rx.sad + rx.angry === 0) {
      rx.like = Math.max(4, Math.round(likes * 0.5));
      rx.love = Math.max(2, Math.round(likes * 0.25));
      rx.haha = Math.max(1, Math.round(likes * 0.1));
      rx.wow = Math.max(1, Math.round(likes * 0.08));
      rx.sad = Math.max(0, Math.round(likes * 0.04));
      rx.angry = Math.max(0, Math.round(likes * 0.03));
    }
  }

  const engagements = comments + likes + shares + otherClicks + linkClicks + input.approvals;
  const source: ChannelAnalyticsSource = input.live
    ? ('platform' as const)
    : useDemo
      ? ('demo' as const)
      : ('oma_local' as const);
  const displayStatus: ChannelAnalyticsStatus = useDemo ? 'ready' : status;

  return {
    channel: input.channel,
    published: input.isPublished,
    published_at: input.publishedAt ? input.publishedAt.toISOString() : null,
    source,
    platform_connected: input.platformConnected,
    note: useDemo ? DEMO_NOTE : NOTES[status],
    insights_at: input.lastInsightsAt?.toISOString() ?? input.live?.fetchedAt ?? null,
    external_post_id: input.externalPostId ?? null,
    status: displayStatus,
    kpis: { views, engagements, reach },
    organic_views: {
      reach,
      impressions,
      avg_view_duration_s: avgPlay,
      watch_time_m: views && avgPlay ? Number(((views * avgPlay) / 3600).toFixed(2)) : 0,
    },
    organic_engagement: {
      likes,
      comments,
      shares,
      reposts: shares,
      replies: comments,
      profile_clicks: profileClicks,
      link_clicks: linkClicks,
      other_clicks: otherClicks,
    },
    plays: {
      views,
      three_second: plays3s,
      one_minute: plays1m,
      avg_seconds: avgPlay,
    },
    reactions: rx,
    approvals: input.approvals,
    comments: input.live ? comments : input.omaCommentsTotal,
  };
}
