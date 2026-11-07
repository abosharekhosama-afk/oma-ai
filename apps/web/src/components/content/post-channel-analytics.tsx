'use client';

import {
  CommentOutlined,
  EyeOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  RetweetOutlined,
  ShareAltOutlined,
  UserOutlined,
} from '../ui/lucide-icons';

type ChannelAnalytics = {
  channel: string;
  published: boolean;
  published_at: string | null;
  source: 'oma_local' | 'platform';
  platform_connected: boolean;
  note: string;
  insights_at?: string | null;
  kpis: { views: number; engagements: number; reach: number };
  organic_views: {
    reach: number;
    impressions: number;
    avg_view_duration_s: number;
    watch_time_m?: number;
  };
  organic_engagement: {
    likes: number;
    comments: number;
    shares: number;
    reposts?: number;
    replies?: number;
    profile_clicks?: number;
    link_clicks?: number;
    other_clicks?: number;
  };
  plays: { views: number; three_second: number; one_minute: number; avg_seconds: number };
  reactions: { like: number; love: number; haha: number; wow: number; sad: number; angry: number };
  approvals: number;
};

function fmt(n: number, locale: string) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 2).replace(/\.00$/, '')}K`;
  return new Intl.NumberFormat(locale.startsWith('ar') ? 'ar' : 'en').format(n);
}

function durClock(seconds: number) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PostChannelAnalytics({
  data,
  locale,
  onViewAll,
}: {
  data: ChannelAnalytics;
  locale: string;
  onViewAll: () => void;
}) {
  const ar = locale.toLowerCase().startsWith('ar');
  const ch = data.channel.toLowerCase();
  const isFacebook = ch.includes('facebook') || ch.includes('meta_fb') || ch === 'fb';
  const isX = ch === 'x' || ch.includes('twitter');
  const isYoutube = ch.includes('youtube') || ch === 'yt';
  const isTiktok = ch.includes('tiktok');

  const rx = data.reactions;
  const rxTotal =
    rx.like + rx.love + rx.haha + rx.wow + rx.sad + rx.angry || data.organic_engagement.likes;

  const viewsVal = data.kpis.views || data.organic_views.impressions || 0;
  const reachVal = data.kpis.reach || data.organic_views.reach || viewsVal;
  const engVal = data.kpis.engagements || 0;

  return (
    <div
      className="oma-post-an oma-plx-post-an"
      data-testid="content-channel-analytics"
      data-channel={ch}
    >
      {/* Top KPI Cards Row */}
      {isFacebook ? (
        <div className="oma-plx-post-an__kpis oma-plx-post-an__kpis--3">
          <div className="oma-plx-post-an__kpi">
            <div className="oma-plx-post-an__kpi-top">
              <span>{ar ? 'المشاهدات' : 'Views'}</span>
              <EyeOutlined />
            </div>
            <strong className="oma-ltr">{fmt(viewsVal, locale)}</strong>
            <div className="oma-plx-post-an__kpi-bar">
              <span style={{ width: '58%' }} />
            </div>
          </div>
          <div className="oma-plx-post-an__kpi">
            <div className="oma-plx-post-an__kpi-top">
              <span>{ar ? 'الوصول' : 'Reach'}</span>
              <UserOutlined />
            </div>
            <strong className="oma-ltr">{fmt(reachVal, locale)}</strong>
            <div className="oma-plx-post-an__kpi-bar oma-plx-post-an__kpi-bar--teal">
              <span style={{ width: '64%' }} />
            </div>
          </div>
          <div className="oma-plx-post-an__kpi">
            <div className="oma-plx-post-an__kpi-top">
              <span>{ar ? 'التفاعل' : 'Engmt'}</span>
              <ShareAltOutlined />
            </div>
            <strong className="oma-ltr">{fmt(engVal, locale)}</strong>
          </div>
        </div>
      ) : isX ? (
        <div className="oma-plx-post-an__kpis oma-plx-post-an__kpis--2">
          <div className="oma-plx-post-an__kpi">
            <div className="oma-plx-post-an__kpi-top">
              <span>{ar ? 'مرات الظهور' : 'Impressions'}</span>
              <EyeOutlined />
            </div>
            <strong className="oma-ltr">
              {fmt(data.organic_views.impressions || viewsVal, locale)}
            </strong>
          </div>
          <div className="oma-plx-post-an__kpi">
            <div className="oma-plx-post-an__kpi-top">
              <span>{ar ? 'التفاعلات' : 'Engagements'}</span>
              <ShareAltOutlined />
            </div>
            <strong className="oma-ltr">{fmt(engVal, locale)}</strong>
          </div>
        </div>
      ) : (
        <div className="oma-plx-post-an__kpis oma-plx-post-an__kpis--2">
          <div className="oma-plx-post-an__kpi">
            <div className="oma-plx-post-an__kpi-top">
              <span>{ar ? 'المشاهدات' : 'Views'}</span>
              <EyeOutlined />
            </div>
            <strong className="oma-ltr">{fmt(viewsVal, locale)}</strong>
            <div className="oma-plx-post-an__kpi-bar">
              <span style={{ width: viewsVal > 0 ? '52%' : '18%' }} />
            </div>
          </div>
          <div className="oma-plx-post-an__kpi">
            <div className="oma-plx-post-an__kpi-top">
              <span>{ar ? 'التفاعلات' : 'Engagements'}</span>
              <ShareAltOutlined />
            </div>
            <strong className="oma-ltr">{fmt(engVal, locale)}</strong>
          </div>
        </div>
      )}

      {/* Network-Specific Breakdown Blocks */}
      {isFacebook || isTiktok ? (
        <section className="oma-plx-post-an__sec">
          <header className="oma-plx-post-an__sec-head">
            <h4>
              {ar ? 'التشغيل' : 'Plays'} <InfoCircleOutlined />
            </h4>
          </header>
          <ul className="oma-plx-post-an__rows">
            <li>
              <span>
                <PlayCircleOutlined /> {ar ? 'مشاهدات فيديو 3 ثوانٍ' : '3-second video views'}
              </span>
              <b className="oma-ltr">{fmt(data.plays.three_second, locale)}</b>
            </li>
            <li>
              <span>
                <PlayCircleOutlined /> {ar ? 'مشاهدات فيديو لدقيقة' : '1-minute video views'}
              </span>
              <b className="oma-ltr">{fmt(data.plays.one_minute, locale)}</b>
            </li>
            <li>
              <span>
                <PlayCircleOutlined /> {ar ? 'متوسط دقائق المشاهدة' : 'Avg. minutes viewed'}
              </span>
              <b className="oma-ltr">{durClock(data.plays.avg_seconds)}</b>
            </li>
          </ul>
        </section>
      ) : null}

      {isFacebook ? (
        <section className="oma-plx-post-an__sec">
          <header className="oma-plx-post-an__sec-head">
            <h4>
              {ar ? 'التفاعلات' : 'Engagements'} <InfoCircleOutlined />
            </h4>
            <strong className="oma-ltr">{fmt(engVal, locale)}</strong>
          </header>
          <div className="oma-plx-post-an__rx-grid">
            <div className="oma-plx-post-an__rx-pill">
              <span>👍</span>
              <b className="oma-ltr">{rx.like}</b>
            </div>
            <div className="oma-plx-post-an__rx-pill">
              <span>❤️</span>
              <b className="oma-ltr">{rx.love}</b>
            </div>
            <div className="oma-plx-post-an__rx-pill">
              <span>😂</span>
              <b className="oma-ltr">{rx.haha}</b>
            </div>
            <div className="oma-plx-post-an__rx-pill">
              <span>😮</span>
              <b className="oma-ltr">{rx.wow}</b>
            </div>
            <div className="oma-plx-post-an__rx-pill">
              <span>😢</span>
              <b className="oma-ltr">{rx.sad}</b>
            </div>
            <div className="oma-plx-post-an__rx-pill">
              <span>😡</span>
              <b className="oma-ltr">{rx.angry}</b>
            </div>
          </div>
          <ul className="oma-plx-post-an__rows">
            <li>
              <span>
                <HeartOutlined /> {ar ? 'التفاعلات' : 'Reactions'}
              </span>
              <b className="oma-ltr">{fmt(rxTotal, locale)}</b>
            </li>
            <li>
              <span>
                <CommentOutlined /> {ar ? 'التعليقات' : 'Comments'}
              </span>
              <b className="oma-ltr">{fmt(data.organic_engagement.comments, locale)}</b>
            </li>
            <li>
              <span>
                <ShareAltOutlined /> {ar ? 'المشاركات' : 'Shares'}
              </span>
              <b className="oma-ltr">{fmt(data.organic_engagement.shares, locale)}</b>
            </li>
            <li>
              <span>
                <LinkOutlined /> {ar ? 'نقرات الرابط' : 'Link clicks'}
              </span>
              <b className="oma-ltr">{fmt(data.organic_engagement.link_clicks ?? 0, locale)}</b>
            </li>
            <li>
              <span>
                <ShareAltOutlined /> {ar ? 'نقرات أخرى' : 'Other clicks'}
              </span>
              <b className="oma-ltr">{fmt(data.organic_engagement.other_clicks ?? 0, locale)}</b>
            </li>
          </ul>
        </section>
      ) : isX ? (
        <section className="oma-plx-post-an__sec">
          <header className="oma-plx-post-an__sec-head">
            <h4>
              {ar ? 'التفاعل' : 'Engagement'} <InfoCircleOutlined />
            </h4>
            <strong className="oma-ltr">{fmt(engVal, locale)}</strong>
          </header>
          <ul className="oma-plx-post-an__rows">
            <li>
              <span>
                <HeartOutlined /> {ar ? 'الإعجابات' : 'Likes'}
              </span>
              <b className="oma-ltr">{fmt(data.organic_engagement.likes, locale)}</b>
            </li>
            <li>
              <span>
                <RetweetOutlined /> {ar ? 'إعادة النشر' : 'Reposts'}
              </span>
              <b className="oma-ltr">
                {fmt(data.organic_engagement.reposts ?? data.organic_engagement.shares, locale)}
              </b>
            </li>
            <li>
              <span>
                <CommentOutlined /> {ar ? 'الردود' : 'Replies'}
              </span>
              <b className="oma-ltr">
                {fmt(data.organic_engagement.replies ?? data.organic_engagement.comments, locale)}
              </b>
            </li>
            <li>
              <span>
                <UserOutlined /> {ar ? 'نقرات الملف الشخصي' : 'Profile clicks'}
              </span>
              <b className="oma-ltr">{fmt(data.organic_engagement.profile_clicks ?? 0, locale)}</b>
            </li>
          </ul>
        </section>
      ) : isYoutube ? (
        <>
          <section className="oma-plx-post-an__sec">
            <header className="oma-plx-post-an__sec-head">
              <h4>
                {ar ? 'المشاهدات العضوية' : 'Organic views'} <InfoCircleOutlined />
              </h4>
              <strong className="oma-ltr">{fmt(viewsVal, locale)}</strong>
            </header>
            <ul className="oma-plx-post-an__rows">
              <li>
                <span>
                  <PlayCircleOutlined /> {ar ? 'وقت المشاهدة' : 'Watch time'}
                </span>
                <b className="oma-ltr">{(data.organic_views.watch_time_m ?? 0).toFixed(2)}m</b>
              </li>
              <li>
                <span>
                  <PlayCircleOutlined /> {ar ? 'متوسط مدة المشاهدة' : 'Avg. view duration'}
                </span>
                <b className="oma-ltr">
                  {(data.organic_views.avg_view_duration_s / 60).toFixed(2)}m
                </b>
              </li>
            </ul>
          </section>
          <section className="oma-plx-post-an__sec">
            <header className="oma-plx-post-an__sec-head">
              <h4>
                {ar ? 'التفاعل العضوي' : 'Organic engagement'} <InfoCircleOutlined />
              </h4>
              <strong className="oma-ltr">{fmt(engVal, locale)}</strong>
            </header>
            <ul className="oma-plx-post-an__rows">
              <li>
                <span>
                  <HeartOutlined /> {ar ? 'الإعجابات' : 'Likes'}
                </span>
                <b className="oma-ltr">{fmt(data.organic_engagement.likes, locale)}</b>
              </li>
              <li>
                <span>
                  <CommentOutlined /> {ar ? 'التعليقات' : 'Comments'}
                </span>
                <b className="oma-ltr">{fmt(data.organic_engagement.comments, locale)}</b>
              </li>
              <li>
                <span>
                  <ShareAltOutlined /> {ar ? 'المشاركات' : 'Shares'}
                </span>
                <b className="oma-ltr">{fmt(data.organic_engagement.shares, locale)}</b>
              </li>
            </ul>
          </section>
        </>
      ) : (
        <>
          <section className="oma-plx-post-an__sec">
            <header className="oma-plx-post-an__sec-head">
              <h4>
                {ar ? 'المشاهدات العضوية' : 'Organic views'} <InfoCircleOutlined />
              </h4>
              <strong className="oma-ltr">{fmt(viewsVal, locale)}</strong>
            </header>
            <ul className="oma-plx-post-an__rows">
              <li>
                <span>{ar ? 'الوصول' : 'Reach'}</span>
                <b className="oma-ltr">{fmt(reachVal, locale)}</b>
              </li>
              <li>
                <span>{ar ? 'مرات الظهور' : 'Impressions'}</span>
                <b className="oma-ltr">{fmt(data.organic_views.impressions, locale)}</b>
              </li>
            </ul>
          </section>
          <section className="oma-plx-post-an__sec">
            <header className="oma-plx-post-an__sec-head">
              <h4>
                {ar ? 'التفاعل العضوي' : 'Organic engagement'} <InfoCircleOutlined />
              </h4>
              <strong className="oma-ltr">{fmt(engVal, locale)}</strong>
            </header>
            <ul className="oma-plx-post-an__rows">
              <li>
                <span>
                  <HeartOutlined /> {ar ? 'الإعجابات' : 'Likes'}
                </span>
                <b className="oma-ltr">{fmt(data.organic_engagement.likes, locale)}</b>
              </li>
              <li>
                <span>
                  <CommentOutlined /> {ar ? 'التعليقات' : 'Comments'}
                </span>
                <b className="oma-ltr">{fmt(data.organic_engagement.comments, locale)}</b>
              </li>
              <li>
                <span>
                  <ShareAltOutlined /> {ar ? 'المشاركات' : 'Shares'}
                </span>
                <b className="oma-ltr">{fmt(data.organic_engagement.shares, locale)}</b>
              </li>
            </ul>
          </section>
        </>
      )}

      {/* Bottom View all analytics card */}
      <button
        type="button"
        className="oma-plx-post-an__all-card"
        onClick={onViewAll}
        data-testid="content-channel-analytics-view-all"
      >
        <div className="oma-plx-post-an__all-top">
          <span>📊</span>
          <strong>{ar ? 'عرض كل التحليلات' : 'View all analytics'}</strong>
        </div>
        <span className="oma-plx-post-an__all-sub">
          {ar
            ? `${fmt(Math.max(viewsVal, reachVal, engVal), locale)} إجمالي التفاعلات والظهور`
            : `${fmt(Math.max(viewsVal, reachVal, engVal), locale)} post impressions over the past week`}
        </span>
      </button>
    </div>
  );
}

export type { ChannelAnalytics };
