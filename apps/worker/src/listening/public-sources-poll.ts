import { listeningSearchTerms } from '@oma/domain';
import { createLogger } from '@oma/observability';
import { matchedTerms, recordListeningHit } from './record-hit';

const log = createLogger('listening-public-poll');

export type ListeningPlatform =
  'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN' | 'X' | 'WHATSAPP' | 'REDDIT' | 'WEB' | 'YOUTUBE';

function parseArr(s: string): string[] {
  try {
    const j = JSON.parse(s);
    return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function platformAllowed(platforms: string[], p: string) {
  return !platforms.length || platforms.includes(p);
}

const UA = 'oma-listening/1.0';

let redditTokenCache: { token: string; exp: number } | null = null;

async function redditAccessToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID?.trim();
  const secret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  if (redditTokenCache && redditTokenCache.exp > Date.now() + 30_000) return redditTokenCache.token;
  try {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const body = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!res.ok || !body.access_token) return null;
    redditTokenCache = {
      token: body.access_token,
      exp: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  } catch {
    return null;
  }
}

async function pollReddit(
  rule: { id: string; tenantId: string },
  keywords: string[],
  hashtags: string[],
  q: string,
): Promise<{ ingested: number; errors: string[] }> {
  if (!q) return { ingested: 0, errors: [] };
  const errors: string[] = [];
  let ingested = 0;
  try {
    const token = await redditAccessToken();
    const url = token
      ? `https://oauth.reddit.com/search?q=${encodeURIComponent(q)}&sort=new&limit=25&raw_json=1`
      : `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=25`;
    const headers: Record<string, string> = { 'User-Agent': UA };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      data?: {
        children?: Array<{
          data?: {
            id?: string;
            title?: string;
            selftext?: string;
            author?: string;
            permalink?: string;
            created_utc?: number;
            ups?: number;
            num_comments?: number;
          };
        }>;
      };
    };
    for (const child of body.data?.children ?? []) {
      const d = child.data;
      if (!d?.id) continue;
      const content = [d.title, d.selftext].filter(Boolean).join('\n');
      const terms = matchedTerms(content, keywords, hashtags);
      if (!terms.length && keywords.length + hashtags.length > 0) continue;
      const r = await recordListeningHit({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        platform: 'REDDIT',
        externalPostId: d.id,
        authorName: d.author ?? 'Reddit user',
        authorHandle: d.author ? `u/${d.author}` : null,
        content,
        url: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
        matchedKeywords: terms,
        likeCount: d.ups ?? 0,
        commentCount: d.num_comments ?? 0,
        capturedAt: d.created_utc ? new Date(d.created_utc * 1000) : undefined,
      });
      if (r === 'created' || r === 'updated') ingested += 1;
    }
  } catch (e) {
    errors.push(`reddit:${e instanceof Error ? e.message : String(e)}`);
  }
  return { ingested, errors };
}

async function pollYoutube(
  rule: { id: string; tenantId: string },
  keywords: string[],
  hashtags: string[],
  q: string,
): Promise<{ ingested: number; errors: string[] }> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return { ingested: 0, errors: ['youtube:YOUTUBE_API_KEY_missing'] };
  if (!q) return { ingested: 0, errors: [] };
  const errors: string[] = [];
  let ingested = 0;
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q,
      type: 'video',
      maxResults: '25',
      order: 'date',
      key,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const body = (await res.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          title?: string;
          description?: string;
          channelTitle?: string;
          publishedAt?: string;
        };
      }>;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    for (const item of body.items ?? []) {
      const vid = item.id?.videoId;
      if (!vid) continue;
      const sn = item.snippet;
      const content = [sn?.title, sn?.description].filter(Boolean).join('\n');
      const terms = matchedTerms(content, keywords, hashtags);
      if (!terms.length && keywords.length + hashtags.length > 0) continue;
      const r = await recordListeningHit({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        platform: 'YOUTUBE',
        externalPostId: vid,
        authorName: sn?.channelTitle ?? 'YouTube channel',
        content,
        url: `https://www.youtube.com/watch?v=${vid}`,
        matchedKeywords: terms,
        capturedAt: sn?.publishedAt ? new Date(sn.publishedAt) : undefined,
      });
      if (r === 'created' || r === 'updated') ingested += 1;
    }
  } catch (e) {
    errors.push(`youtube:${e instanceof Error ? e.message : String(e)}`);
  }
  return { ingested, errors };
}

async function pollWeb(
  rule: { id: string; tenantId: string },
  keywords: string[],
  hashtags: string[],
  q: string,
  opts?: { platform?: 'WEB' | 'LINKEDIN' | 'TIKTOK'; site?: string; authorName?: string },
): Promise<{ ingested: number; errors: string[] }> {
  const platform = opts?.platform ?? 'WEB';
  const cseKey = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cseCx = process.env.GOOGLE_CSE_CX?.trim();
  if (!cseKey || !cseCx)
    return { ingested: 0, errors: [`${platform.toLowerCase()}:GOOGLE_CSE_not_configured`] };
  if (!q) return { ingested: 0, errors: [] };
  const query = opts?.site ? `${q} site:${opts.site}` : q;
  const errors: string[] = [];
  let ingested = 0;
  try {
    const params = new URLSearchParams({
      key: cseKey,
      cx: cseCx,
      q: query,
      num: '10',
      dateRestrict: 'd7',
    });
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    const body = (await res.json()) as {
      items?: Array<{ title?: string; link?: string; snippet?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    for (const item of body.items ?? []) {
      const content = [item.title, item.snippet].filter(Boolean).join('\n');
      const terms = matchedTerms(content, keywords, hashtags);
      if (!terms.length && keywords.length + hashtags.length > 0) continue;
      const extId = Buffer.from(item.link ?? content)
        .toString('base64url')
        .slice(0, 48);
      const r = await recordListeningHit({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        platform,
        externalPostId: extId,
        authorName: opts?.authorName ?? 'Web',
        content,
        url: item.link ?? null,
        matchedKeywords: terms,
      });
      if (r === 'created' || r === 'updated') ingested += 1;
    }
  } catch (e) {
    errors.push(`${platform.toLowerCase()}:${e instanceof Error ? e.message : String(e)}`);
  }
  return { ingested, errors };
}

async function xBearerToken(): Promise<string | null> {
  const direct = process.env.X_BEARER_TOKEN?.trim();
  if (direct) return direct;
  const id = process.env.X_CLIENT_ID?.trim();
  const secret = process.env.X_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  try {
    const res = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const body = (await res.json()) as { access_token?: string };
    return res.ok ? (body.access_token ?? null) : null;
  } catch {
    return null;
  }
}

async function pollX(
  rule: { id: string; tenantId: string },
  keywords: string[],
  hashtags: string[],
  q: string,
): Promise<{ ingested: number; errors: string[] }> {
  if (!q) return { ingested: 0, errors: [] };
  const token = await xBearerToken();
  if (!token) return { ingested: 0, errors: ['x:X_BEARER_TOKEN_missing'] };
  const errors: string[] = [];
  let ingested = 0;
  try {
    const params = new URLSearchParams({
      query: q.slice(0, 512),
      max_results: '25',
      'tweet.fields': 'created_at,public_metrics,author_id',
      expansions: 'author_id',
      'user.fields': 'name,username',
    });
    const res = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as {
      data?: Array<{
        id: string;
        text?: string;
        author_id?: string;
        created_at?: string;
        public_metrics?: { like_count?: number; reply_count?: number; retweet_count?: number };
      }>;
      includes?: { users?: Array<{ id: string; name?: string; username?: string }> };
      errors?: Array<{ message?: string }>;
      title?: string;
      detail?: string;
    };
    if (!res.ok)
      throw new Error(
        body.detail || body.title || body.errors?.[0]?.message || `HTTP ${res.status}`,
      );
    const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u]));
    for (const tweet of body.data ?? []) {
      const content = tweet.text ?? '';
      const terms = matchedTerms(content, keywords, hashtags);
      if (!terms.length && keywords.length + hashtags.length > 0) continue;
      const author = tweet.author_id ? users.get(tweet.author_id) : undefined;
      const r = await recordListeningHit({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        platform: 'X',
        externalPostId: tweet.id,
        authorName: author?.name ?? 'X user',
        authorHandle: author?.username ? `@${author.username}` : null,
        content,
        url: author?.username
          ? `https://x.com/${author.username}/status/${tweet.id}`
          : `https://x.com/i/web/status/${tweet.id}`,
        matchedKeywords: terms,
        likeCount: tweet.public_metrics?.like_count ?? 0,
        commentCount: tweet.public_metrics?.reply_count ?? 0,
        shareCount: tweet.public_metrics?.retweet_count ?? 0,
        capturedAt: tweet.created_at ? new Date(tweet.created_at) : undefined,
      });
      if (r === 'created' || r === 'updated') ingested += 1;
    }
  } catch (e) {
    errors.push(`x:${e instanceof Error ? e.message : String(e)}`);
  }
  return { ingested, errors };
}

async function pollTikTokResearch(
  rule: { id: string; tenantId: string },
  keywords: string[],
  hashtags: string[],
  q: string,
): Promise<{ ingested: number; errors: string[] }> {
  const key = process.env.TIKTOK_RESEARCH_CLIENT_KEY?.trim();
  const secret = process.env.TIKTOK_RESEARCH_CLIENT_SECRET?.trim();
  if (!key || !secret) return { ingested: 0, errors: ['tiktok:TIKTOK_RESEARCH_not_configured'] };
  if (!q) return { ingested: 0, errors: [] };
  const errors: string[] = [];
  let ingested = 0;
  try {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: key,
        client_secret: secret,
        grant_type: 'client_credentials',
      }),
    });
    const tokenBody = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenBody.access_token) {
      throw new Error(
        tokenBody.error_description || tokenBody.error || `token HTTP ${tokenRes.status}`,
      );
    }
    const startDate = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      'https://open.tiktokapis.com/v2/research/video/query/?fields=id,video_description,create_time,username,like_count,comment_count,share_count,view_count',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenBody.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            and: [{ operation: 'IN', field_name: 'keyword', field_values: [q.slice(0, 80)] }],
          },
          start_date: startDate.replace(/-/g, ''),
          end_date: endDate.replace(/-/g, ''),
          max_count: 25,
        }),
      },
    );
    const body = (await res.json()) as {
      data?: {
        videos?: Array<{
          id?: string;
          video_description?: string;
          create_time?: number;
          username?: string;
          like_count?: number;
          comment_count?: number;
          share_count?: number;
        }>;
      };
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    for (const video of body.data?.videos ?? []) {
      if (!video.id) continue;
      const content = video.video_description ?? '';
      const terms = matchedTerms(content, keywords, hashtags);
      if (!terms.length && keywords.length + hashtags.length > 0) continue;
      const r = await recordListeningHit({
        tenantId: rule.tenantId,
        ruleId: rule.id,
        platform: 'TIKTOK',
        externalPostId: video.id,
        authorName: video.username ?? 'TikTok user',
        authorHandle: video.username ? `@${video.username}` : null,
        content,
        url: video.username ? `https://www.tiktok.com/@${video.username}/video/${video.id}` : null,
        matchedKeywords: terms,
        likeCount: video.like_count ?? 0,
        commentCount: video.comment_count ?? 0,
        shareCount: video.share_count ?? 0,
        capturedAt: video.create_time ? new Date(video.create_time * 1000) : undefined,
      });
      if (r === 'created' || r === 'updated') ingested += 1;
    }
  } catch (e) {
    errors.push(`tiktok:${e instanceof Error ? e.message : String(e)}`);
  }
  return { ingested, errors };
}

/** Reddit, YouTube, web, X, and official/fallback sources when env keys are set. */
export async function pollPublicListeningSources(rule: {
  id: string;
  tenantId: string;
  keywordsJson: string;
  hashtagsJson: string;
  platformsJson: string;
}): Promise<{ ingested: number; errors: string[] }> {
  const keywords = parseArr(rule.keywordsJson);
  const hashtags = parseArr(rule.hashtagsJson);
  const platforms = parseArr(rule.platformsJson);
  let ingested = 0;
  const errors: string[] = [];

  const queries = listeningSearchTerms(keywords, hashtags);
  const youtubeReady = Boolean(process.env.YOUTUBE_API_KEY?.trim());
  const webReady = Boolean(
    process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim(),
  );
  const xReady = Boolean(
    process.env.X_BEARER_TOKEN?.trim() ||
    (process.env.X_CLIENT_ID?.trim() && process.env.X_CLIENT_SECRET?.trim()),
  );
  const tiktokResearchReady = Boolean(
    process.env.TIKTOK_RESEARCH_CLIENT_KEY?.trim() &&
    process.env.TIKTOK_RESEARCH_CLIENT_SECRET?.trim(),
  );
  if (platformAllowed(platforms, 'YOUTUBE') && !youtubeReady) {
    errors.push('youtube:YOUTUBE_API_KEY_missing');
  }
  if (platformAllowed(platforms, 'WEB') && !webReady) {
    errors.push('web:GOOGLE_CSE_not_configured');
  }
  if (platformAllowed(platforms, 'X') && !xReady) {
    errors.push('x:X_BEARER_TOKEN_missing');
  }
  if (platformAllowed(platforms, 'TIKTOK') && !tiktokResearchReady && !webReady) {
    errors.push('tiktok:TIKTOK_RESEARCH_not_configured');
  }
  if (platformAllowed(platforms, 'LINKEDIN') && !webReady) {
    errors.push('linkedin:GOOGLE_CSE_not_configured');
  }
  for (const q of queries) {
    if (platformAllowed(platforms, 'REDDIT')) {
      const r = await pollReddit(rule, keywords, hashtags, q);
      ingested += r.ingested;
      errors.push(...r.errors);
    }
    if (platformAllowed(platforms, 'YOUTUBE') && youtubeReady) {
      const r = await pollYoutube(rule, keywords, hashtags, q);
      ingested += r.ingested;
      errors.push(...r.errors);
    }
    if (platformAllowed(platforms, 'WEB') && webReady) {
      const r = await pollWeb(rule, keywords, hashtags, q);
      ingested += r.ingested;
      errors.push(...r.errors);
    }
    if (platformAllowed(platforms, 'X') && xReady) {
      const r = await pollX(rule, keywords, hashtags, q);
      ingested += r.ingested;
      errors.push(...r.errors);
    }
    if (platformAllowed(platforms, 'TIKTOK')) {
      if (tiktokResearchReady) {
        const r = await pollTikTokResearch(rule, keywords, hashtags, q);
        ingested += r.ingested;
        errors.push(...r.errors);
      } else if (webReady) {
        const r = await pollWeb(rule, keywords, hashtags, q, {
          platform: 'TIKTOK',
          site: 'tiktok.com',
          authorName: 'TikTok',
        });
        ingested += r.ingested;
        errors.push(...r.errors);
      }
    }
    if (platformAllowed(platforms, 'LINKEDIN') && webReady) {
      const r = await pollWeb(rule, keywords, hashtags, q, {
        platform: 'LINKEDIN',
        site: 'linkedin.com',
        authorName: 'LinkedIn',
      });
      ingested += r.ingested;
      errors.push(...r.errors);
    }
  }

  if (errors.length) log.info({ ruleId: rule.id, errors: errors.length, ingested }, 'public poll');
  return { ingested, errors };
}
