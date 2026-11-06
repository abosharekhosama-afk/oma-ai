'use client';

type ChannelAnalytics = {
  channel: string;
  published: boolean;
  published_at: string | null;
  source: 'oma_local';
  platform_connected: boolean;
  note: string;
  kpis: { views: number; engagements: number; reach: number };
  organic_views: { reach: number; impressions: number; avg_view_duration_s: number };
  organic_engagement: { likes: number; comments: number; shares: number };
  plays: { views: number; three_second: number; one_minute: number; avg_seconds: number };
  reactions: { like: number; love: number; haha: number; wow: number; sad: number; angry: number };
  approvals: number;
};

function fmt(n: number, locale: string) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return new Intl.NumberFormat(locale.startsWith('ar') ? 'ar' : 'en').format(n);
}

function dur(seconds: number, ar: boolean) {
  if (!seconds) return '0:00s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}${ar ? 'ث' : 's'}`;
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
  const tiktok = ch.includes('tiktok');
  const facebook = ch.includes('facebook') || ch.includes('meta_fb') || ch === 'fb';
  const rx = data.reactions;
  const rxTotal = rx.like + rx.love + rx.haha + rx.wow + rx.sad + rx.angry;

  return (
    <div className="oma-post-an" data-testid="content-channel-analytics">
      <div className="oma-post-an__kpis">
        <div>
          <span>{ar ? 'المشاهدات' : 'Views'}</span>
          <strong className="oma-ltr">{fmt(data.kpis.views, locale)}</strong>
        </div>
        {tiktok ? (
          <div>
            <span>{ar ? 'الوصول' : 'Reach'}</span>
            <strong className="oma-ltr">{fmt(data.kpis.reach, locale)}</strong>
          </div>
        ) : null}
        <div>
          <span>{tiktok ? (ar ? 'التفاعل' : 'Engmt') : ar ? 'التفاعلات' : 'Engagements'}</span>
          <strong className="oma-ltr">{fmt(data.kpis.engagements, locale)}</strong>
        </div>
      </div>

      {!tiktok ? (
        <section className="oma-post-an__block">
          <h4>{ar ? 'مشاهدات عضوية' : 'Organic views'}</h4>
          <ul>
            <li>
              <span>{ar ? 'الوصول' : 'Reach'}</span>
              <b className="oma-ltr">{fmt(data.organic_views.reach, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'الظهور' : 'Impressions'}</span>
              <b className="oma-ltr">{fmt(data.organic_views.impressions, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'متوسط مدة المشاهدة' : 'Avg. view duration'}</span>
              <b className="oma-ltr">{dur(data.organic_views.avg_view_duration_s, ar)}</b>
            </li>
          </ul>
        </section>
      ) : null}

      {tiktok ? (
        <section className="oma-post-an__block">
          <h4>{ar ? 'تشغيل' : 'Plays'}</h4>
          <ul>
            <li>
              <span>{ar ? 'مشاهدات الفيديو' : 'Video views'}</span>
              <b className="oma-ltr">{fmt(data.plays.views, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'مشاهدات 3 ثوانٍ' : '3-second video views'}</span>
              <b className="oma-ltr">{fmt(data.plays.three_second, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'مشاهدات دقيقة' : '1-minute video views'}</span>
              <b className="oma-ltr">{fmt(data.plays.one_minute, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'متوسط مدة المشاهدة' : 'Avg. view duration'}</span>
              <b className="oma-ltr">{dur(data.plays.avg_seconds, ar)}</b>
            </li>
          </ul>
        </section>
      ) : (
        <section className="oma-post-an__block">
          <h4>{ar ? 'تفاعل عضوي' : 'Organic engagement'}</h4>
          <ul>
            <li>
              <span>{ar ? 'إعجابات' : 'Likes'}</span>
              <b className="oma-ltr">{fmt(data.organic_engagement.likes, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'تعليقات' : 'Comments'}</span>
              <b className="oma-ltr">{fmt(data.organic_engagement.comments, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'مشاركات' : 'Shares'}</span>
              <b className="oma-ltr">{fmt(data.organic_engagement.shares, locale)}</b>
            </li>
          </ul>
        </section>
      )}

      {facebook || rxTotal > 0 ? (
        <section className="oma-post-an__block">
          <h4>
            {ar ? 'التفاعلات' : 'Engagements'}{' '}
            <em className="oma-ltr">{fmt(data.kpis.engagements, locale)}</em>
          </h4>
          <div className="oma-post-an__rx" aria-hidden>
            <span>👍 {rx.like}</span>
            <span>❤️ {rx.love}</span>
            <span>😂 {rx.haha}</span>
            <span>😮 {rx.wow}</span>
            <span>😢 {rx.sad}</span>
            <span>😡 {rx.angry}</span>
          </div>
          <ul>
            <li>
              <span>{ar ? 'تفاعلات' : 'Reactions'}</span>
              <b className="oma-ltr">{fmt(rxTotal, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'تعليقات' : 'Comments'}</span>
              <b className="oma-ltr">{fmt(data.organic_engagement.comments, locale)}</b>
            </li>
            <li>
              <span>{ar ? 'مشاركات' : 'Shares'}</span>
              <b className="oma-ltr">{fmt(data.organic_engagement.shares, locale)}</b>
            </li>
          </ul>
        </section>
      ) : null}

      <p className="oma-post-an__note">{data.note}</p>
      <button type="button" className="oma-post-an__all" onClick={onViewAll}>
        {ar ? 'عرض كل التحليلات' : 'View all analytics'}
      </button>
    </div>
  );
}

export type { ChannelAnalytics };
