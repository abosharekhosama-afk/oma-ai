import { newId, parsePostInsights, snapshotMetricsFromInsights } from '@oma/domain';
import { getPrisma } from './prisma.service';

export async function upsertPostMetricSnapshot(input: {
  tenantId: string;
  brandId: string;
  socialPageId: string;
  publishTargetId?: string | null;
  contentItemId?: string | null;
  externalPostId?: string | null;
  publishedAt: Date | null | undefined;
  insightsJson: string | null | undefined;
  source?: string;
  capturedAt?: Date;
}): Promise<boolean> {
  if (!input.publishedAt || Number.isNaN(input.publishedAt.getTime())) return false;
  const parsed = parsePostInsights(input.insightsJson);
  if (!parsed) return false;
  const metrics = snapshotMetricsFromInsights(parsed);
  const capturedAt = input.capturedAt ?? new Date();
  const prisma = getPrisma();
  const data = {
    tenantId: input.tenantId,
    brandId: input.brandId,
    socialPageId: input.socialPageId,
    publishTargetId: input.publishTargetId || null,
    contentItemId: input.contentItemId || null,
    externalPostId: input.externalPostId || null,
    publishedAt: input.publishedAt,
    impressions: metrics.impressions,
    reach: metrics.reach,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    views: metrics.views,
    engagementRate: metrics.engagementRate,
    source: input.source ?? 'insights_json',
    capturedAt,
  };
  if (input.publishTargetId) {
    await prisma.postMetricSnapshot.upsert({
      where: { publishTargetId: input.publishTargetId },
      create: { id: newId(), ...data, publishTargetId: input.publishTargetId },
      update: data,
    });
    return true;
  }
  if (input.externalPostId) {
    await prisma.postMetricSnapshot.upsert({
      where: {
        socialPageId_externalPostId: {
          socialPageId: input.socialPageId,
          externalPostId: input.externalPostId,
        },
      },
      create: { id: newId(), ...data, externalPostId: input.externalPostId },
      update: data,
    });
    return true;
  }
  return false;
}
