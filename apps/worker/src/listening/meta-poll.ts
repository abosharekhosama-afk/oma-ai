import { getPrisma } from '@oma/db';
import { decryptToken, tokenKeyFromEnv } from '@oma/domain';
import { createLogger } from '@oma/observability';
import { matchedTerms, recordListeningHit } from './record-hit';
import { bridgeInboxMessagesToListening } from './inbox-bridge';

const log = createLogger('listening-meta-poll');

const GRAPH = 'https://graph.facebook.com';
const v = () => process.env.META_GRAPH_VERSION || 'v21.0';

async function graphGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${v()}/${path}?${q}`);
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message || `Graph HTTP ${res.status}`);
  return body;
}

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

export async function runListeningPoll(ruleId: string): Promise<{ ingested: number; errors: string[] }> {
  const prisma = getPrisma();
  const rule = await prisma.listeningRule.findFirst({ where: { id: ruleId, isLive: true } });
  if (!rule) return { ingested: 0, errors: ['rule_not_found'] };

  const keywords = parseArr(rule.keywordsJson);
  const hashtags = parseArr(rule.hashtagsJson);
  const platforms = parseArr(rule.platformsJson);
  const key = tokenKeyFromEnv(process.env);
  let ingested = 0;
  const errors: string[] = [];

  const pages = await prisma.socialPage.findMany({
    where: {
      tenantId: rule.tenantId,
      status: 'CONNECTED',
      network: { in: ['FACEBOOK', 'INSTAGRAM'] },
      ...(rule.brandId ? { brandId: rule.brandId } : {}),
    },
  });

  if (key) {
    for (const page of pages) {
      let accessToken: string;
      try {
        accessToken = decryptToken(page.accessTokenEnc, key);
      } catch {
        errors.push(`decrypt:${page.id}`);
        continue;
      }

      if (page.network === 'FACEBOOK' && platformAllowed(platforms, 'META_FB')) {
        try {
          const tagged = await graphGet<{
            data?: Array<{
              id: string;
              message?: string;
              permalink_url?: string;
              full_picture?: string;
              created_time?: string;
              from?: { name?: string; id?: string };
              likes?: { summary?: { total_count?: number } };
              comments?: { summary?: { total_count?: number } };
            }>;
          }>(`${page.externalId}/tagged`, accessToken, {
            fields: 'message,from,created_time,permalink_url,full_picture,likes.summary(true),comments.summary(true)',
            limit: '50',
          });
          for (const post of tagged.data ?? []) {
            const content = post.message ?? '';
            const terms = matchedTerms(content, keywords, hashtags);
            if (!terms.length && keywords.length + hashtags.length > 0) continue;
            const r = await recordListeningHit({
              tenantId: rule.tenantId,
              ruleId: rule.id,
              platform: 'META_FB',
              externalPostId: post.id,
              authorName: post.from?.name ?? 'Facebook user',
              authorHandle: post.from?.id ?? null,
              content,
              url: post.permalink_url ?? null,
              mediaUrls: post.full_picture ? [post.full_picture] : [],
              matchedKeywords: terms,
              likeCount: post.likes?.summary?.total_count ?? 0,
              commentCount: post.comments?.summary?.total_count ?? 0,
              capturedAt: post.created_time ? new Date(post.created_time) : undefined,
            });
            if (r === 'created' || r === 'updated') ingested += 1;
          }
        } catch (e) {
          errors.push(`fb_tagged:${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (page.network === 'INSTAGRAM' && platformAllowed(platforms, 'META_IG')) {
        const igUserId = page.externalId;
        try {
          const tags = await graphGet<{
            data?: Array<{
              id: string;
              caption?: string;
              permalink?: string;
              media_url?: string;
              thumbnail_url?: string;
              timestamp?: string;
              like_count?: number;
              comments_count?: number;
              username?: string;
            }>;
          }>(`${igUserId}/tags`, accessToken, {
            fields: 'id,caption,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count,username',
            limit: '50',
          });
          for (const media of tags.data ?? []) {
            const content = media.caption ?? '';
            const terms = matchedTerms(content, keywords, hashtags);
            if (!terms.length && keywords.length + hashtags.length > 0) continue;
            const r = await recordListeningHit({
              tenantId: rule.tenantId,
              ruleId: rule.id,
              platform: 'META_IG',
              externalPostId: media.id,
              authorName: media.username ?? 'Instagram user',
              authorHandle: media.username ? `@${media.username}` : null,
              content,
              url: media.permalink ?? null,
              mediaUrls: [media.thumbnail_url || media.media_url].filter(Boolean) as string[],
              matchedKeywords: terms,
              likeCount: media.like_count ?? 0,
              commentCount: media.comments_count ?? 0,
              capturedAt: media.timestamp ? new Date(media.timestamp) : undefined,
            });
            if (r === 'created' || r === 'updated') ingested += 1;
          }
        } catch (e) {
          errors.push(`ig_tags:${e instanceof Error ? e.message : String(e)}`);
        }

        for (const tag of hashtags.slice(0, 5)) {
          const q = tag.replace(/^#/, '');
          if (!q) continue;
          try {
            const search = await graphGet<{ data?: Array<{ id: string }> }>('ig_hashtag_search', accessToken, {
              user_id: igUserId,
              q,
            });
            const hashtagId = search.data?.[0]?.id;
            if (!hashtagId) continue;
            const recent = await graphGet<{
              data?: Array<{
                id: string;
                caption?: string;
                permalink?: string;
                media_url?: string;
                timestamp?: string;
                like_count?: number;
                comments_count?: number;
              }>;
            }>(`${hashtagId}/recent_media`, accessToken, {
              user_id: igUserId,
              fields: 'id,caption,permalink,media_url,timestamp,like_count,comments_count',
            });
            for (const media of recent.data ?? []) {
              const content = media.caption ?? '';
              const terms = matchedTerms(content, keywords, [tag]);
              const r = await recordListeningHit({
                tenantId: rule.tenantId,
                ruleId: rule.id,
                platform: 'META_IG',
                externalPostId: media.id,
                authorName: 'Instagram',
                content,
                url: media.permalink ?? null,
                mediaUrls: media.media_url ? [media.media_url] : [],
                matchedKeywords: terms.length ? terms : [tag],
                likeCount: media.like_count ?? 0,
                commentCount: media.comments_count ?? 0,
                capturedAt: media.timestamp ? new Date(media.timestamp) : undefined,
              });
              if (r === 'created' || r === 'updated') ingested += 1;
            }
          } catch (e) {
            errors.push(`ig_hashtag_${q}:${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }
  } else {
    errors.push('SOCIAL_TOKEN_ENCRYPTION_KEY missing');
  }

  try {
    ingested += await bridgeInboxMessagesToListening(rule);
  } catch (e) {
    errors.push(`inbox_bridge:${e instanceof Error ? e.message : String(e)}`);
  }

  await prisma.listeningRule.update({
    where: { id: rule.id },
    data: { lastPollAt: new Date() },
  });

  log.info({ ruleId, ingested, errors: errors.length }, 'listening poll complete');
  return { ingested, errors };
}
