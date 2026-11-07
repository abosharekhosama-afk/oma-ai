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
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=25`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
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
): Promise<{ ingested: number; errors: string[] }> {
  const cseKey = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cseCx = process.env.GOOGLE_CSE_CX?.trim();
  if (!cseKey || !cseCx) return { ingested: 0, errors: ['web:GOOGLE_CSE_not_configured'] };
  if (!q) return { ingested: 0, errors: [] };
  const errors: string[] = [];
  let ingested = 0;
  try {
    const params = new URLSearchParams({
      key: cseKey,
      cx: cseCx,
      q,
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
        platform: 'WEB',
        externalPostId: extId,
        authorName: 'Web',
        content,
        url: item.link ?? null,
        matchedKeywords: terms,
      });
      if (r === 'created' || r === 'updated') ingested += 1;
    }
  } catch (e) {
    errors.push(`web:${e instanceof Error ? e.message : String(e)}`);
  }
  return { ingested, errors };
}

/** Reddit (public), YouTube Data API, and Google CSE web mentions when env keys are set. */
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
  if (platformAllowed(platforms, 'YOUTUBE') && !youtubeReady) {
    errors.push('youtube:YOUTUBE_API_KEY_missing');
  }
  if (platformAllowed(platforms, 'WEB') && !webReady) {
    errors.push('web:GOOGLE_CSE_not_configured');
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
  }

  if (errors.length) log.info({ ruleId: rule.id, errors: errors.length, ingested }, 'public poll');
  return { ingested, errors };
}
