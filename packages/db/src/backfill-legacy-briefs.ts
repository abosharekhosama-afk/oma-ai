import { Prisma, type PrismaClient } from '@prisma/client';
import {
  LEGACY_BRIEF_ORIGIN,
  newId,
  planLegacyBrief,
  type LegacyBriefSkipReason,
} from '@oma/domain';

/**
 * One-off, idempotent backfill of WorkRequest brief columns into Brief rows
 * (DEC-019 §7). Safe to re-run: `Brief @@unique([tenantId, requestId])` means
 * a request is backfilled at most once, and existing briefs are never touched.
 * Never approves: ready legacy briefs land IN_REVIEW, the rest DRAFT.
 */

export type LegacyBriefBackfillOptions = {
  /** Restrict to one tenant. Omit to process every tenant. */
  tenantId?: string;
  /** Report what would happen without writing. Default true. */
  dryRun?: boolean;
  batchSize?: number;
  now?: () => Date;
};

export type LegacyBriefBackfillReport = {
  dryRun: boolean;
  scanned: number;
  created: { draft: number; inReview: number };
  skipped: Record<LegacyBriefSkipReason | 'already_backfilled', number>;
  createdBriefIds: string[];
};

const AUDIT_ACTION = 'brief.legacy_backfilled';
export const LEGACY_BACKFILL_DECISION_NOTE = 'legacy_request_backfill';

export async function backfillLegacyBriefs(
  prisma: PrismaClient,
  options: LegacyBriefBackfillOptions = {},
): Promise<LegacyBriefBackfillReport> {
  const dryRun = options.dryRun ?? true;
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 200, 1000));
  const now = options.now ?? (() => new Date());
  const report: LegacyBriefBackfillReport = {
    dryRun,
    scanned: 0,
    created: { draft: 0, inReview: 0 },
    skipped: {
      already_backfilled: 0,
      request_closed: 0,
      request_has_tasks: 0,
      no_brief_content: 0,
    },
    createdBriefIds: [],
  };

  let cursor: string | undefined;
  for (;;) {
    const requests = await prisma.workRequest.findMany({
      where: options.tenantId ? { tenantId: options.tenantId } : {},
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        tenantId: true,
        brandId: true,
        status: true,
        titleEn: true,
        titleAr: true,
        descriptionEn: true,
        briefObjectiveEn: true,
        briefObjectiveAr: true,
        briefAudienceEn: true,
        briefAudienceAr: true,
        briefKeyMessageEn: true,
        briefKeyMessageAr: true,
        briefReadyAt: true,
        channels: true,
        formats: true,
        dueAt: true,
        requesterUserId: true,
        strategyId: true,
        strategyVersionId: true,
        _count: { select: { tasks: true } },
      },
    });
    if (requests.length === 0) break;
    cursor = requests[requests.length - 1]!.id;

    const existing = new Set(
      (
        await prisma.brief.findMany({
          where: { requestId: { in: requests.map((r) => r.id) } },
          select: { requestId: true },
        })
      ).map((b) => b.requestId),
    );

    for (const req of requests) {
      report.scanned += 1;
      if (existing.has(req.id)) {
        report.skipped.already_backfilled += 1;
        continue;
      }
      const plan = planLegacyBrief({
        ...req,
        channels: req.channels.map(String),
        formats: req.formats.map(String),
        taskCount: req._count.tasks,
      });
      if (plan.action === 'skip') {
        report.skipped[plan.reason] += 1;
        continue;
      }
      const inReview = plan.status === 'IN_REVIEW';
      if (dryRun) {
        report.created[inReview ? 'inReview' : 'draft'] += 1;
        continue;
      }

      const briefId = newId();
      const versionId = newId();
      const at = now();
      try {
        await prisma.$transaction(async (tx) => {
          await tx.brief.create({
            data: {
              id: briefId,
              tenantId: req.tenantId,
              brandId: req.brandId,
              title: plan.title,
              status: plan.status,
              origin: LEGACY_BRIEF_ORIGIN,
              requestId: req.id,
              strategyId: req.strategyId,
              strategyVersionId: req.strategyVersionId,
              currentVersionId: versionId,
              currentVersionNo: 1,
              createdBy: req.requesterUserId,
            },
          });
          await tx.briefVersion.create({
            data: {
              id: versionId,
              tenantId: req.tenantId,
              briefId,
              versionNo: 1,
              contentJson: JSON.stringify(plan.content),
              authorUserId: req.requesterUserId,
              submittedAt: inReview ? (req.briefReadyAt ?? at) : null,
            },
          });
          if (inReview) {
            await tx.briefDecision.create({
              data: {
                id: newId(),
                tenantId: req.tenantId,
                briefId,
                briefVersionId: versionId,
                kind: 'SUBMIT',
                fromStatus: 'DRAFT',
                toStatus: 'IN_REVIEW',
                comment: LEGACY_BACKFILL_DECISION_NOTE,
                actorUserId: req.requesterUserId,
                createdAt: req.briefReadyAt ?? at,
              },
            });
          }
          await tx.auditEvent.create({
            data: {
              id: newId(),
              occurredAt: at,
              actorType: 'system',
              tenantId: req.tenantId,
              action: AUDIT_ACTION,
              targetType: 'Brief',
              targetId: briefId,
              beforeRef: `work_request:${req.id}`,
              afterRef: plan.status,
            },
          });
        });
      } catch (err) {
        // A concurrent run (or the API) created the brief first: idempotent skip.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          report.skipped.already_backfilled += 1;
          continue;
        }
        throw err;
      }
      report.created[inReview ? 'inReview' : 'draft'] += 1;
      report.createdBriefIds.push(briefId);
    }
  }
  return report;
}
