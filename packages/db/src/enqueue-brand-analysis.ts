import {
  DEFAULT_PLAN_FOR_NEW_TENANTS,
  isAiAnalysisAvailable,
  newId,
  normalizePlanCode,
} from '@oma/domain';
import { enforceAndConsumeUsage, hydratePlan } from './billing-usage';
import { writeOutbox } from './outbox';
import { getPrisma } from './prisma.service';

export async function tenantAllowsAiAssist(tenantId: string): Promise<boolean> {
  const sub = await getPrisma().workspaceSubscription.findUnique({ where: { tenantId } });
  const planCode = normalizePlanCode(sub?.planCode ?? '') ?? DEFAULT_PLAN_FOR_NEW_TENANTS;
  const plan = await hydratePlan(planCode);
  return Boolean(plan.features.ai_assist);
}

export async function consumeAiCreditOnce(tenantId: string) {
  return enforceAndConsumeUsage(tenantId, 'ai_credits_per_month', 1);
}

export async function enqueueBrandAnalysis(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  profileVersionId: string;
  actorUserId: string;
  correlationId?: string | null;
  idempotencyKey?: string;
}): Promise<{ queued: boolean; jobRunId?: string; reason?: string }> {
  if (!isAiAnalysisAvailable()) {
    await getPrisma().scanAttempt.updateMany({
      where: { id: input.scanAttemptId, tenantId: input.tenantId },
      data: {
        analysisStatus: 'SKIPPED',
        aiAvailability: 'NOT_CONFIGURED',
        analysisErrorCode: 'AI_NOT_CONFIGURED',
      },
    });
    await getPrisma().profileVersion.updateMany({
      where: { id: input.profileVersionId, tenantId: input.tenantId },
      data: {
        analysisStatus: 'SKIPPED',
        aiAvailability: 'NOT_CONFIGURED',
      },
    });
    return { queued: false, reason: 'NOT_CONFIGURED' };
  }
  if (!(await tenantAllowsAiAssist(input.tenantId))) {
    await getPrisma().scanAttempt.updateMany({
      where: { id: input.scanAttemptId, tenantId: input.tenantId },
      data: {
        analysisStatus: 'SKIPPED',
        aiAvailability: 'SKIPPED',
        analysisErrorCode: 'PLAN_FEATURE_REQUIRED',
      },
    });
    await getPrisma().profileVersion.updateMany({
      where: { id: input.profileVersionId, tenantId: input.tenantId },
      data: { analysisStatus: 'SKIPPED' },
    });
    return { queued: false, reason: 'PLAN_FEATURE_REQUIRED' };
  }

  const idempotencyKey =
    input.idempotencyKey ?? `analysis:${input.scanAttemptId}:${input.profileVersionId}`;
  const existing = await getPrisma().jobRun.findUnique({ where: { idempotencyKey } });
  if (existing) return { queued: false, jobRunId: existing.id, reason: 'idempotent' };

  const jobRunId = newId();
  await getPrisma().$transaction(async (tx) => {
    await tx.jobRun.create({
      data: {
        id: jobRunId,
        tenantId: input.tenantId,
        queue: 'analysis',
        jobType: 'analysis.brand_profile',
        status: 'QUEUED',
        payloadJson: JSON.stringify({
          scan_attempt_id: input.scanAttemptId,
          brand_id: input.brandId,
          profile_version_id: input.profileVersionId,
        }),
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        idempotencyKey,
      },
    });
    await tx.scanAttempt.updateMany({
      where: { id: input.scanAttemptId, tenantId: input.tenantId },
      data: {
        analysisStatus: 'QUEUED',
        aiAvailability: 'SKIPPED',
        analysisErrorCode: null,
      },
    });
    await tx.profileVersion.updateMany({
      where: { id: input.profileVersionId, tenantId: input.tenantId },
      data: { analysisStatus: 'QUEUED', aiAvailability: 'SKIPPED' },
    });
    await writeOutbox(tx, {
      tenantId: input.tenantId,
      eventType: 'analysis.brand_profile',
      payload: {
        jobRunId,
        scanAttemptId: input.scanAttemptId,
        profileVersionId: input.profileVersionId,
        tenantId: input.tenantId,
        brandId: input.brandId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        idempotencyKey,
      },
    });
  });
  return { queued: true, jobRunId };
}
