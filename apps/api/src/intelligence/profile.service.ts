import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  canEditProfile,
  evaluateApprovalEligibility,
  isRequiredForApproval,
  newId,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProfileService {
  constructor(private readonly audit: AuditService) {}

  async get(tenantId: string, brandId: string, versionId: string) {
    const version = await this.loadVersion(tenantId, brandId, versionId);
    const insights = await getPrisma().insightClaim.findMany({
      where: tenantWhere(tenantId, { profileVersionId: versionId }),
    });
    const scan = version.scanAttemptId
      ? await getPrisma().scanAttempt.findFirst({
          where: tenantWhere(tenantId, { id: version.scanAttemptId }),
        })
      : null;
    const requiredMissing: string[] = [];
    for (const insight of insights) {
      if (isRequiredForApproval(insight.fieldKey) && insight.reviewStatus === 'REJECTED') {
        requiredMissing.push(insight.fieldKey);
      }
    }
    const eligibility = evaluateApprovalEligibility({
      profileStatus: version.status,
      scanStatus: (scan?.status ?? 'FAILED') as never,
      requiredFieldsPresent: insights
        .filter((i) => isRequiredForApproval(i.fieldKey) && i.reviewStatus !== 'REJECTED')
        .map((i) => i.fieldKey),
      requiredFieldsMissing: requiredMissing,
      claimsWithoutEvidence: insights
        .filter((i) => isRequiredForApproval(i.fieldKey) && !i.evidenceId)
        .map((i) => i.fieldKey),
      unresolvedAiInferred: insights
        .filter((i) => i.infoState === 'AI_INFERRED' && i.reviewStatus === 'PENDING')
        .map((i) => i.fieldKey),
      // Client confirmation gates are enforced in the UI and on approve POST only.
      acknowledgeIncomplete: scan?.status !== 'PARTIAL',
      confirmSummary: true,
      isPartialScan: scan?.status === 'PARTIAL',
    });
    const reviewDecisions = await getPrisma().reviewDecision.findMany({
      where: tenantWhere(tenantId, { profileVersionId: versionId }),
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const humanEdits = await getPrisma().humanEdit.findMany({
      where: tenantWhere(tenantId, { profileVersionId: versionId }),
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      data: {
        id: version.id,
        status: version.status,
        row_version: version.rowVersion,
        scan_attempt_id: version.scanAttemptId,
        ai_availability: version.aiAvailability,
        sections: version.sectionsJson ? JSON.parse(version.sectionsJson) : {},
        insights: insights.map((i) => ({
          id: i.id,
          field_key: i.fieldKey,
          info_state: i.infoState,
          review_status: i.reviewStatus,
          discovery_tier: i.discoveryTier,
          evidence_id: i.evidenceId,
          text_value: i.textValue,
          value_json: i.valueJson ? JSON.parse(i.valueJson) : null,
          row_version: i.rowVersion,
        })),
        coverage_snapshot: version.coverageSnapshotJson
          ? JSON.parse(version.coverageSnapshotJson)
          : null,
        eligibility: {
          approvable: eligibility.approvable,
          blocking_reasons: eligibility.blockingReasons,
        },
        review_history: [
          ...reviewDecisions.map((d) => ({
            id: d.id,
            kind: 'decision' as const,
            action: d.action,
            created_at: d.createdAt.toISOString(),
          })),
          ...humanEdits.map((e) => ({
            id: e.id,
            kind: 'edit' as const,
            action: e.action,
            created_at: e.createdAt.toISOString(),
          })),
        ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        created_at: version.createdAt.toISOString(),
        approved_at: version.approvedAt?.toISOString() ?? null,
      },
    };
  }

  async list(tenantId: string, brandId: string, query: { cursor?: string; limit?: number }) {
    const limit = Math.min(query.limit ?? 25, 100);
    const rows = await getPrisma().profileVersion.findMany({
      where: tenantWhere(tenantId, {
        brandId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      }),
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: data.map((v) => ({
        id: v.id,
        status: v.status,
        created_at: v.createdAt.toISOString(),
        approved_at: v.approvedAt?.toISOString() ?? null,
        scan_attempt_id: v.scanAttemptId,
        ai_availability: v.aiAvailability,
      })),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  async compare(tenantId: string, brandId: string, versionId: string, againstId?: string) {
    const left = await this.get(tenantId, brandId, versionId);
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    const rightId = againstId ?? brand?.currentApprovedProfileVersionId;
    if (!rightId) {
      return { data: { left: left.data, right: null, diff: [] } };
    }
    const right = await this.get(tenantId, brandId, rightId);
    const leftInsights = new Map(
      (left.data.insights as { field_key: string }[]).map((i) => [i.field_key, i]),
    );
    const diff: { field_key: string; left: unknown; right: unknown }[] = [];
    for (const ri of right.data.insights as { field_key: string }[]) {
      const li = leftInsights.get(ri.field_key);
      diff.push({ field_key: ri.field_key, left: li ?? null, right: ri });
    }
    return { data: { left: left.data, right: right.data, diff } };
  }

  async patch(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    versionId: string,
    input: {
      row_version: number;
      sections?: Record<string, unknown>;
      insights?: { id: string; text_value?: string }[];
    },
    correlationId?: string,
  ) {
    const version = await this.loadVersion(tenantId, brandId, versionId);
    if (!canEditProfile(version.status as never)) {
      throw new DomainError('CONFLICT_STATE', 'Not editable', 409, 'errors.conflict_state');
    }
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }

    await getPrisma().$transaction(async (tx) => {
      await tx.profileVersion.update({
        where: { id: versionId },
        data: {
          rowVersion: { increment: 1 },
          status: version.status === 'DRAFT' ? 'NEEDS_REVIEW' : version.status,
          sectionsJson: input.sections ? JSON.stringify(input.sections) : version.sectionsJson,
        },
      });
      if (input.insights) {
        for (const patch of input.insights) {
          const insight = await tx.insightClaim.findFirst({
            where: tenantWhere(tenantId, { id: patch.id, profileVersionId: versionId }),
          });
          if (!insight) continue;
          await tx.insightClaim.update({
            where: { id: patch.id },
            data: {
              textValue: patch.text_value ?? insight.textValue,
              infoState: 'USER_CORRECTED',
              reviewStatus: 'EDITED',
              rowVersion: { increment: 1 },
            },
          });
          await tx.humanEdit.create({
            data: {
              id: newId(),
              tenantId,
              brandId,
              profileVersionId: versionId,
              insightId: patch.id,
              actorUserId,
              action: 'EDIT',
              beforeRef: insight.textValue,
              afterRef: patch.text_value,
              correlationId,
            },
          });
        }
      }
      if (version.status === 'DRAFT') {
        const deepLinkPath = `/app/brands/${brandId}/profiles/${versionId}`;
        await tx.notification.upsert({
          where: {
            tenantId_dedupeKey: {
              tenantId,
              dedupeKey: `profile.review:${versionId}`,
            },
          },
          create: {
            id: newId(),
            tenantId,
            recipientUserId: actorUserId,
            type: 'brand.profile.needs_review',
            objectType: 'ProfileVersion',
            objectId: versionId,
            deepLinkPath,
            dedupeKey: `profile.review:${versionId}`,
          },
          update: {},
        });
      }
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.profile.edited',
      targetType: 'ProfileVersion',
      targetId: versionId,
      correlationId,
    });
    return this.get(tenantId, brandId, versionId);
  }

  private async loadVersion(tenantId: string, brandId: string, versionId: string) {
    const version = await getPrisma().profileVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId }),
    });
    if (!version) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return version;
  }
}
