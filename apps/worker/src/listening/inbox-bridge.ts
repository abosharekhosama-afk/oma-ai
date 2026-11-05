import { getPrisma } from '@oma/db';
import { matchedTerms, recordListeningHit } from './record-hit';

function parseArr(s: string): string[] {
  try {
    const j = JSON.parse(s);
    return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Promote recent inbox inbound messages that match rule keywords into listening hits. */
export async function bridgeInboxMessagesToListening(rule: {
  id: string;
  tenantId: string;
  brandId: string | null;
  keywordsJson: string;
  hashtagsJson: string;
  platformsJson: string;
}): Promise<number> {
  const keywords = parseArr(rule.keywordsJson);
  const hashtags = parseArr(rule.hashtagsJson);
  const platforms = parseArr(rule.platformsJson);
  if (!keywords.length && !hashtags.length) return 0;

  const since = new Date(Date.now() - 14 * 86400_000);
  const messages = await getPrisma().inboxMessage.findMany({
    where: {
      tenantId: rule.tenantId,
      direction: 'INBOUND',
      createdAt: { gte: since },
      conversation: {
        ...(rule.brandId ? { brandId: rule.brandId } : {}),
        ...(platforms.length ? { platform: { in: platforms as never[] } } : {}),
      },
    },
    include: { conversation: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  let n = 0;
  for (const m of messages) {
    const terms = matchedTerms(m.content, keywords, hashtags);
    if (!terms.length) continue;
    const extId = m.externalMessageId || `inbox-msg-${m.id}`;
    const r = await recordListeningHit({
      tenantId: rule.tenantId,
      ruleId: rule.id,
      platform: m.conversation.platform as 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN',
      externalPostId: extId,
      authorName: m.senderName,
      authorHandle: m.senderExternalId,
      authorAvatar: m.senderAvatar,
      content: m.content,
      matchedKeywords: terms,
      commentCount: 1,
      capturedAt: m.createdAt,
    });
    if (r === 'created' || r === 'updated') n += 1;
  }
  return n;
}
