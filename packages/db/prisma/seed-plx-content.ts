/**
 * Extra content fixtures for Planable preview/schedule screenshots:
 * multi-media carousel, Story, Reels, and a hide-from-clients post.
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

async function main() {
  const env = process.env.OMA_ENV ?? process.env.NODE_ENV;
  if (env !== 'development' && env !== 'test') {
    throw new Error(`refused outside development/test (got ${env})`);
  }
  const email = (process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL ?? 'platform-owner@example.com')
    .trim()
    .toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`missing owner ${email}`);
  const brand = await prisma.brandWorkspace.findFirst({
    where: { name: { contains: 'Acme' } },
  });
  if (!brand) throw new Error('missing Acme demo brand');
  const tenantId = brand.tenantId;
  const brandId = brand.id;

  const mkAsset = async (seed: string, mime = 'image/jpeg', name?: string) => {
    const id = newId();
    await prisma.mediaAsset.upsert({
      where: {
        tenantId_brandId_workdriveFileId: {
          tenantId,
          brandId,
          workdriveFileId: `demo:${seed}`,
        },
      },
      create: {
        id,
        tenantId,
        brandId,
        kind: 'posts',
        workdriveFileId: `demo:${seed}`,
        name: name ?? `${seed}.jpg`,
        mime,
        size: 120_000,
        status: 'READY',
        source: 'upload',
        createdBy: user.id,
      },
      update: { status: 'READY', mime, name: name ?? `${seed}.jpg` },
    });
    const row = await prisma.mediaAsset.findUniqueOrThrow({
      where: {
        tenantId_brandId_workdriveFileId: {
          tenantId,
          brandId,
          workdriveFileId: `demo:${seed}`,
        },
      },
    });
    return row;
  };

  const a1 = await mkAsset('carousel-1');
  const a2 = await mkAsset('carousel-2');
  const a3 = await mkAsset('carousel-3');
  const story = await mkAsset('story-vert');
  const reel = await mkAsset('reel-video', 'video/mp4', 'reel.mp4');
  const hidden = await mkAsset('hidden-team');

  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

  async function upsertContent(input: {
    key: string;
    titleEn: string;
    titleAr: string;
    captionEn: string;
    captionAr: string;
    contentType: 'POST' | 'STORY' | 'REEL' | 'CAROUSEL';
    channel: string;
    assetIds: string[];
    clientVisible?: boolean;
    scheduledAt?: Date;
  }) {
    const existing = await prisma.contentItem.findFirst({
      where: { tenantId, brandId, titleEn: input.titleEn },
    });
    const first = input.assetIds[0]!;
    const previewUrl = `/api/v1/media/${first}/view`;
    const data = {
      tenantId,
      brandId,
      titleEn: input.titleEn,
      titleAr: input.titleAr,
      captionEn: input.captionEn,
      captionAr: input.captionAr,
      contentType: input.contentType,
      channel: input.channel,
      track: 'ORGANIC' as const,
      status: 'APPROVED' as const,
      approvalState: 'APPROVED' as const,
      scheduleState: input.scheduledAt ? ('SCHEDULED' as const) : ('UNSCHEDULED' as const),
      plannedAt: input.scheduledAt ?? null,
      scheduledAt: input.scheduledAt ?? null,
      timezone: 'Asia/Dubai',
      previewAssetId: first,
      previewAssetUrl: previewUrl,
      mediaAssetIds: input.assetIds,
      clientVisible: input.clientVisible !== false,
      createdBy: user.id,
      labels: [input.key],
    };
    if (existing) {
      return prisma.contentItem.update({ where: { id: existing.id }, data });
    }
    return prisma.contentItem.create({ data: { id: newId(), ...data } });
  }

  const carousel = await upsertContent({
    key: 'plx-carousel',
    titleEn: 'Carousel — summer flavors',
    titleAr: 'كاروسيل — نكهات الصيف',
    captionEn: 'Swipe through our summer flavors. Ready for your next delicious vacay?',
    captionAr: 'مرّر بين نكهات الصيف. مستعد لعطلتك اللذيذة التالية؟',
    contentType: 'CAROUSEL',
    channel: 'instagram',
    assetIds: [a1.id, a2.id, a3.id],
    scheduledAt: inTwoDays,
  });

  const storyPost = await upsertContent({
    key: 'plx-story',
    titleEn: 'Story — behind the scenes',
    titleAr: 'قصة — خلف الكواليس',
    captionEn: 'A quick look behind the scenes.',
    captionAr: 'لمحة سريعة من خلف الكواليس.',
    contentType: 'STORY',
    channel: 'instagram',
    assetIds: [story.id],
    scheduledAt: tomorrow,
  });

  const reelPost = await upsertContent({
    key: 'plx-reel',
    titleEn: 'Reels — kitchen motion',
    titleAr: 'ريلز — حركة المطبخ',
    captionEn: 'Watch the kitchen come alive.',
    captionAr: 'شاهد المطبخ ينبض بالحياة.',
    contentType: 'REEL',
    channel: 'instagram',
    assetIds: [reel.id],
    scheduledAt: tomorrow,
  });

  const hiddenPost = await upsertContent({
    key: 'plx-hidden',
    titleEn: 'Team only — draft notes',
    titleAr: 'للفريق فقط — ملاحظات مسودة',
    captionEn: 'Internal notes hidden from clients.',
    captionAr: 'ملاحظات داخلية مخفية عن العملاء.',
    contentType: 'POST',
    channel: 'facebook',
    assetIds: [hidden.id],
    clientVisible: false,
    scheduledAt: inTwoDays,
  });

  console.log(
    JSON.stringify(
      {
        brandId,
        carousel: carousel.id,
        story: storyPost.id,
        reel: reelPost.id,
        hidden: hiddenPost.id,
        assets: [a1.id, a2.id, a3.id, story.id, reel.id, hidden.id],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
