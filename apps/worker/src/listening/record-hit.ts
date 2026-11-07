import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

const NEG =
  /\b(bad|awful|terrible|hate|angry|worst|scam|refund|broken|disappointed|horrible|poor|fail)\b|سيء|سيئة|فظيع|احتيال|غاضب|محبط/i;
const POS =
  /\b(great|love|amazing|excellent|thanks|thank you|awesome|perfect|wonderful|best)\b|رائع|ممتاز|شكرا|أحب|ممتازة|جميل/i;

function classify(text: string): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' {
  const t = (text || '').trim();
  if (!t) return 'NEUTRAL';
  const neg = NEG.test(t);
  const pos = POS.test(t);
  if (neg && !pos) return 'NEGATIVE';
  if (pos && !neg) return 'POSITIVE';
  return 'NEUTRAL';
}

function matchedTerms(content: string, keywords: string[], hashtags: string[]) {
  const lower = content.toLowerCase();
  const hits: string[] = [];
  for (const k of keywords) {
    if (k && lower.includes(k.toLowerCase())) hits.push(k);
  }
  for (const h of hashtags) {
    const tag = h.replace(/^#/, '').toLowerCase();
    if (tag && (lower.includes(`#${tag}`) || lower.includes(tag)))
      hits.push(h.startsWith('#') ? h : `#${h}`);
  }
  return [...new Set(hits)];
}

export async function recordListeningHit(input: {
  tenantId: string;
  ruleId: string;
  platform:
    'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN' | 'X' | 'WHATSAPP' | 'REDDIT' | 'WEB' | 'YOUTUBE';
  externalPostId: string;
  authorName?: string | null;
  authorHandle?: string | null;
  authorAvatar?: string | null;
  content: string;
  url?: string | null;
  mediaUrls?: string[];
  matchedKeywords?: string[];
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  capturedAt?: Date;
}): Promise<'created' | 'updated' | 'duplicate'> {
  const prisma = getPrisma();
  const sentiment = classify(input.content);
  const isHighPriority = sentiment === 'NEGATIVE';

  const existing = await prisma.listeningHit.findUnique({
    where: {
      tenantId_ruleId_platform_externalPostId: {
        tenantId: input.tenantId,
        ruleId: input.ruleId,
        platform: input.platform,
        externalPostId: input.externalPostId,
      },
    },
  });

  if (existing) {
    await prisma.listeningHit.update({
      where: { id: existing.id },
      data: {
        content: input.content,
        url: input.url ?? existing.url,
        authorName: input.authorName ?? existing.authorName,
        authorHandle: input.authorHandle ?? existing.authorHandle,
        authorAvatar: input.authorAvatar ?? existing.authorAvatar,
        likeCount: input.likeCount ?? existing.likeCount,
        commentCount: input.commentCount ?? existing.commentCount,
        shareCount: input.shareCount ?? existing.shareCount,
        matchedKeywordsJson: JSON.stringify(
          input.matchedKeywords?.length
            ? input.matchedKeywords
            : JSON.parse(existing.matchedKeywordsJson || '[]'),
        ),
        ...(existing.sentimentLocked
          ? {}
          : {
              sentiment,
              isHighPriority: existing.isHighPriority || isHighPriority,
            }),
      },
    });
    return 'updated';
  }

  await prisma.listeningHit.create({
    data: {
      id: newId(),
      tenantId: input.tenantId,
      ruleId: input.ruleId,
      platform: input.platform,
      externalPostId: input.externalPostId,
      authorName: input.authorName ?? null,
      authorHandle: input.authorHandle ?? null,
      authorAvatar: input.authorAvatar ?? null,
      content: input.content,
      url: input.url ?? null,
      mediaUrlsJson: input.mediaUrls?.length ? JSON.stringify(input.mediaUrls) : null,
      sentiment,
      isHighPriority,
      likeCount: input.likeCount ?? 0,
      commentCount: input.commentCount ?? 0,
      shareCount: input.shareCount ?? 0,
      matchedKeywordsJson: JSON.stringify(input.matchedKeywords ?? []),
      capturedAt: input.capturedAt ?? new Date(),
    },
  });
  return 'created';
}

export { matchedTerms, classify as classifyListeningSentiment };
