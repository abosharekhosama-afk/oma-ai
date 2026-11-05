/**
 * Demo seed for Unified Inbox + Social Listening.
 *
 * Gated by environment variable:
 *   SEED_INBOX_DEMO=1
 *
 * Optional:
 *   SEED_INBOX_DEMO_TENANT_SLUG=oma-demo   (default: oma-demo, else first tenant)
 *   SEED_INBOX_DEMO_ALLOW_PROD=1          (required if NODE_ENV=production)
 *
 * Idempotent: re-running replaces rows tagged with externalThreadId / externalPostId
 * prefixes `demo-inbox-` and `demo-listen-`.
 *
 * Usage:
 *   SEED_INBOX_DEMO=1 pnpm --filter @oma/db seed:inbox-demo
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { newId } from '@oma/domain';

for (let dir = process.cwd(), depth = 0; depth < 5; depth += 1, dir = path.dirname(dir)) {
  const candidate = path.join(dir, '.env');
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

const prisma = new PrismaClient();

const THREAD_PREFIX = 'demo-inbox-';
const POST_PREFIX = 'demo-listen-';
const RULE_NAME_PREFIX = '[Demo] ';

function truthy(v: string | undefined): boolean {
  const s = (v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600_000);
}

function previewOf(text: string, max = 140) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

async function resolveTenantId(): Promise<{ id: string; name: string; slug: string }> {
  const slug = (process.env.SEED_INBOX_DEMO_TENANT_SLUG ?? 'oma-demo').trim();
  const bySlug = await prisma.tenant.findFirst({ where: { slug } });
  if (bySlug) return { id: bySlug.id, name: bySlug.name, slug: bySlug.slug };

  const first = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!first) {
    throw new Error(
      'No tenant found. Create a workspace first (or run seed:demo), then re-run seed:inbox-demo.',
    );
  }
  return { id: first.id, name: first.name, slug: first.slug };
}

async function clearPreviousDemo(tenantId: string) {
  const convs = await prisma.inboxConversation.findMany({
    where: { tenantId, externalThreadId: { startsWith: THREAD_PREFIX } },
    select: { id: true },
  });
  const convIds = convs.map((c) => c.id);
  if (convIds.length) {
    await prisma.inboxInternalNote.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.inboxMessage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.inboxConversation.deleteMany({ where: { id: { in: convIds } } });
  }

  await prisma.listeningHit.deleteMany({
    where: { tenantId, externalPostId: { startsWith: POST_PREFIX } },
  });
  await prisma.listeningRule.deleteMany({
    where: { tenantId, name: { startsWith: RULE_NAME_PREFIX } },
  });
}

type SeedConv = {
  thread: string;
  platform: 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
  type: 'DIRECT_MESSAGE' | 'POST_COMMENT' | 'DARK_COMMENT' | 'MENTION';
  status: 'UNREAD' | 'OPEN' | 'PENDING' | 'CLOSED';
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  participantName: string;
  participantExtId: string;
  subject?: string;
  messages: Array<{
    direction: 'INBOUND' | 'OUTBOUND';
    senderName: string;
    senderExtId: string;
    content: string;
    hoursAgo: number;
  }>;
  notes?: string[];
};

const CONVERSATIONS: SeedConv[] = [
  {
    thread: `${THREAD_PREFIX}ig-dm-sara`,
    platform: 'META_IG',
    type: 'DIRECT_MESSAGE',
    status: 'UNREAD',
    sentiment: 'POSITIVE',
    participantName: 'Sara Al-Harbi',
    participantExtId: 'ig_user_sara',
    messages: [
      {
        direction: 'INBOUND',
        senderName: 'Sara Al-Harbi',
        senderExtId: 'ig_user_sara',
        content: 'Hi! Loved your latest reel — do you ship to Riyadh?',
        hoursAgo: 5,
      },
      {
        direction: 'INBOUND',
        senderName: 'Sara Al-Harbi',
        senderExtId: 'ig_user_sara',
        content: 'Also, is the blue set still available?',
        hoursAgo: 4.5,
      },
    ],
  },
  {
    thread: `${THREAD_PREFIX}fb-comment-omar`,
    platform: 'META_FB',
    type: 'POST_COMMENT',
    status: 'OPEN',
    sentiment: 'NEGATIVE',
    participantName: 'Omar Nasser',
    participantExtId: 'fb_user_omar',
    subject: 'Comment on spring campaign post',
    messages: [
      {
        direction: 'INBOUND',
        senderName: 'Omar Nasser',
        senderExtId: 'fb_user_omar',
        content: 'Order arrived damaged. This is the worst experience.',
        hoursAgo: 12,
      },
      {
        direction: 'OUTBOUND',
        senderName: 'Team',
        senderExtId: 'team',
        content: 'We are sorry about that — please share your order number and we will replace it.',
        hoursAgo: 10,
      },
      {
        direction: 'INBOUND',
        senderName: 'Omar Nasser',
        senderExtId: 'fb_user_omar',
        content: 'Order #A-20481. Please fix this today.',
        hoursAgo: 9,
      },
    ],
    notes: ['Escalated to support — priority refund path.'],
  },
  {
    thread: `${THREAD_PREFIX}tt-dm-layla`,
    platform: 'TIKTOK',
    type: 'DIRECT_MESSAGE',
    status: 'PENDING',
    sentiment: 'NEUTRAL',
    participantName: 'Layla M.',
    participantExtId: 'tt_user_layla',
    messages: [
      {
        direction: 'INBOUND',
        senderName: 'Layla M.',
        senderExtId: 'tt_user_layla',
        content: 'Can I use your track in a collab video?',
        hoursAgo: 28,
      },
    ],
  },
  {
    thread: `${THREAD_PREFIX}li-mention-corp`,
    platform: 'LINKEDIN',
    type: 'MENTION',
    status: 'UNREAD',
    sentiment: 'POSITIVE',
    participantName: 'Nour Hassan',
    participantExtId: 'li_user_nour',
    subject: 'Mention in industry roundup',
    messages: [
      {
        direction: 'INBOUND',
        senderName: 'Nour Hassan',
        senderExtId: 'li_user_nour',
        content: 'Great case study from @OMA on social ops — worth a read.',
        hoursAgo: 2,
      },
    ],
  },
  {
    thread: `${THREAD_PREFIX}ig-dark-anon`,
    platform: 'META_IG',
    type: 'DARK_COMMENT',
    status: 'OPEN',
    sentiment: 'NEGATIVE',
    participantName: 'Instagram user',
    participantExtId: 'ig_dark_9921',
    messages: [
      {
        direction: 'INBOUND',
        senderName: 'Instagram user',
        senderExtId: 'ig_dark_9921',
        content: 'Price is too high compared to competitors.',
        hoursAgo: 6,
      },
    ],
    notes: ['Dark comment — only visible to brand. Consider public FAQ reply.'],
  },
];

async function seedConversations(tenantId: string, actorUserId: string | null) {
  for (const spec of CONVERSATIONS) {
    const convId = newId();
    const last = spec.messages[spec.messages.length - 1]!;
    await prisma.inboxConversation.create({
      data: {
        id: convId,
        tenantId,
        platform: spec.platform,
        externalThreadId: spec.thread,
        type: spec.type,
        status: spec.status,
        sentiment: spec.sentiment,
        subject: spec.subject ?? null,
        participantName: spec.participantName,
        participantExtId: spec.participantExtId,
        lastMessageAt: hoursAgo(last.hoursAgo),
        lastMessagePreview: previewOf(last.content),
        messageCount: spec.messages.length,
        unreadCount: spec.status === 'UNREAD' ? spec.messages.filter((m) => m.direction === 'INBOUND').length : 0,
        metadataJson: JSON.stringify({
          source: 'seed-inbox-demo',
          channelName:
            spec.type === 'DIRECT_MESSAGE'
              ? undefined
              : `OMA Demo · ${spec.platform === 'META_IG' ? 'Instagram' : spec.platform === 'META_FB' ? 'Facebook' : spec.platform === 'TIKTOK' ? 'TikTok' : 'LinkedIn'}`,
          postCaption:
            spec.subject ??
            (spec.type !== 'DIRECT_MESSAGE'
              ? 'Spring collection launch — discover the latest drop from our feed.'
              : undefined),
        }),
      },
    });

    for (const m of spec.messages) {
      await prisma.inboxMessage.create({
        data: {
          id: newId(),
          tenantId,
          conversationId: convId,
          externalMessageId: `${spec.thread}-msg-${m.hoursAgo}`,
          senderExternalId: m.senderExtId,
          senderName: m.senderName,
          content: m.content,
          direction: m.direction,
          createdAt: hoursAgo(m.hoursAgo),
        },
      });
    }

    for (const note of spec.notes ?? []) {
      await prisma.inboxInternalNote.create({
        data: {
          id: newId(),
          tenantId,
          conversationId: convId,
          authorUserId: actorUserId ?? 'demo-seed',
          content: note,
          createdAt: hoursAgo(1),
        },
      });
    }
  }
}

async function seedListening(tenantId: string) {
  const rules = [
    {
      name: `${RULE_NAME_PREFIX}Brand mentions`,
      keywords: ['OMA AI', 'OMA social', 'omai'],
      hashtags: ['OMA', 'SocialOps'],
    },
    {
      name: `${RULE_NAME_PREFIX}Competitor watch`,
      keywords: ['Planable', 'Zoho Social'],
      hashtags: ['SocialMediaTools'],
    },
  ];

  const ruleIds: string[] = [];
  for (const r of rules) {
    const id = newId();
    ruleIds.push(id);
    await prisma.listeningRule.create({
      data: {
        id,
        tenantId,
        workspaceId: tenantId,
        name: r.name,
        keywordsJson: JSON.stringify(r.keywords),
        hashtagsJson: JSON.stringify(r.hashtags),
        platformsJson: JSON.stringify(['META_IG', 'META_FB', 'TIKTOK', 'LINKEDIN']),
        isLive: true,
      },
    });
  }

  const hits: Array<{
    ruleId: string;
    platform: 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
    postId: string;
    authorName: string;
    handle: string;
    content: string;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    priority: boolean;
    keywords: string[];
    hoursAgo: number;
  }> = [
    {
      ruleId: ruleIds[0]!,
      platform: 'META_IG',
      postId: `${POST_PREFIX}ig-1`,
      authorName: 'Marketing Weekly',
      handle: '@mktweekly',
      content: 'OMA AI is quietly building a serious social ops stack for agencies.',
      sentiment: 'POSITIVE',
      priority: false,
      keywords: ['OMA AI'],
      hoursAgo: 3,
    },
    {
      ruleId: ruleIds[0]!,
      platform: 'META_FB',
      postId: `${POST_PREFIX}fb-1`,
      authorName: 'Frustrated Buyer',
      handle: 'fb.com/user/x',
      content: 'Tried OMA social trial — onboarding was confusing and support was slow. Bad experience.',
      sentiment: 'NEGATIVE',
      priority: true,
      keywords: ['OMA social'],
      hoursAgo: 8,
    },
    {
      ruleId: ruleIds[1]!,
      platform: 'LINKEDIN',
      postId: `${POST_PREFIX}li-1`,
      authorName: 'Agency Ops',
      handle: 'linkedin.com/in/ops',
      content: 'Comparing Planable vs Zoho Social for client approvals this quarter.',
      sentiment: 'NEUTRAL',
      priority: false,
      keywords: ['Planable', 'Zoho Social'],
      hoursAgo: 15,
    },
    {
      ruleId: ruleIds[0]!,
      platform: 'TIKTOK',
      postId: `${POST_PREFIX}tt-1`,
      authorName: 'creator.jo',
      handle: '@creator.jo',
      content: '#OMA workflow tips for scheduling Reels across three brands 👏',
      sentiment: 'POSITIVE',
      priority: false,
      keywords: ['OMA'],
      hoursAgo: 1,
    },
  ];

  for (const h of hits) {
    await prisma.listeningHit.create({
      data: {
        id: newId(),
        tenantId,
        ruleId: h.ruleId,
        platform: h.platform,
        externalPostId: h.postId,
        authorName: h.authorName,
        authorHandle: h.handle,
        content: h.content,
        url: null,
        sentiment: h.sentiment,
        isHighPriority: h.priority,
        matchedKeywordsJson: JSON.stringify(h.keywords),
        capturedAt: hoursAgo(h.hoursAgo),
        likeCount: 1200 + h.hoursAgo * 40,
        commentCount: 20 + h.hoursAgo,
      },
    });
  }
}

async function main() {
  if (!truthy(process.env.SEED_INBOX_DEMO)) {
    console.error(
      'Refusing to run: set SEED_INBOX_DEMO=1 to seed Unified Inbox + Listening demo data.',
    );
    process.exit(1);
  }

  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production' && !truthy(process.env.SEED_INBOX_DEMO_ALLOW_PROD)) {
    console.error(
      'Refusing to run in production unless SEED_INBOX_DEMO_ALLOW_PROD=1 is also set.',
    );
    process.exit(1);
  }

  const tenant = await resolveTenantId();
  const membership = await prisma.membership.findFirst({
    where: { tenantId: tenant.id, status: 'ACTIVE' },
    select: { userId: true },
  });

  console.log(`Seeding inbox/listening demo for tenant: ${tenant.name} (${tenant.slug})`);
  await clearPreviousDemo(tenant.id);
  await seedConversations(tenant.id, membership?.userId ?? null);
  await seedListening(tenant.id);

  const [convCount, msgCount, hitCount, ruleCount] = await Promise.all([
    prisma.inboxConversation.count({
      where: { tenantId: tenant.id, externalThreadId: { startsWith: THREAD_PREFIX } },
    }),
    prisma.inboxMessage.count({
      where: { tenantId: tenant.id, externalMessageId: { startsWith: THREAD_PREFIX } },
    }),
    prisma.listeningHit.count({
      where: { tenantId: tenant.id, externalPostId: { startsWith: POST_PREFIX } },
    }),
    prisma.listeningRule.count({
      where: { tenantId: tenant.id, name: { startsWith: RULE_NAME_PREFIX } },
    }),
  ]);

  console.log(`Done. conversations=${convCount} messages=${msgCount} rules=${ruleCount} hits=${hitCount}`);
  console.log('Open /app/inbox and /app/listening while logged into this workspace.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
