import { newId, parsePostInsights, snapshotMetricsFromInsights } from '@oma/domain';
import { getPrisma } from './prisma.service';

export async function upsertPostMetricSnapshot(input: {
  tenantId: string;
  brandId: string;
  socialPageId: string;
  publishTargetId: string;
  contentItemId: string;
  publishedAt: Date | null | undefined;
  insightsJson: string | null | undefined;
  capturedAt?: Date;
}): Promise<boolean> {
  if (!input.publishedAt || Number.isNaN(input.publishedAt.getTime())) return false;
  const parsed = parsePostInsights(input.insightsJson);
  if (!parsed) return false;
  const metrics = snapshotMetricsFromInsights(parsed);
  const capturedAt = input.capturedAt ?? new Date();
  const prisma = getPrisma();
  await prisma.postMetricSnapshot.upsert({
    where: { publishTargetId: input.publishTargetId },
    create: {
      id: newId(),
      tenantId: input.tenantId,
      brandId: input.brandId,
      socialPageId: input.socialPageId,
      publishTargetId: input.publishTargetId,
      contentItemId: input.contentItemId,
      publishedAt: input.publishedAt,
      impressions: metrics.impressions,
      reach: metrics.reach,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      views: metrics.views,
      engagementRate: metrics.engagementRate,
      source: 'insights_json',
      capturedAt,
    },
    update: {
      brandId: input.brandId,
      socialPageId: input.socialPageId,
      contentItemId: input.contentItemId,
      publishedAt: input.publishedAt,
      impressions: metrics.impressions,
      reach: metrics.reach,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      views: metrics.views,
      engagementRate: metrics.engagementRate,
      capturedAt,
    },
  });
  return true;
}
