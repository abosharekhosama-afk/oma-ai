import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  canApproveProfile,
  evaluateApprovalEligibility,
  isRequiredForApproval,
  newId,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ApprovalService {
  constructor(private readonly audit: AuditService) {}

  async approve(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    versionId: string,
    input: {
      row_version: number;
      acknowledge_incomplete: boolean;
      confirm_summary: boolean;
      reason?: string;
    },
    correlationId?: string,
  ) {
    const version = await getPrisma().profileVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId }),
    });
    if (!version) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (!canApproveProfile(version.status as never)) {
      throw new DomainError('CONFLICT_STATE', 'Not approvable state', 409, 'errors.conflict_state');
    }
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }

    const insights = await getPrisma().insightClaim.findMany({
      where: tenantWhere(tenantId, { profileVersionId: versionId }),
    });
    const scan = version.scanAttemptId
      ? await getPrisma().scanAttempt.findFirst({
          where: tenantWhere(tenantId, { id: version.scanAttemptId }),
        })
      : null;

    const requiredMissing = insights
      .filter(
        (i) => isRequiredForApproval(i.fieldKey) && (i.reviewStatus === 'REJECTED' || !i.textValue),
      )
      .map((i) => i.fieldKey);

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
      acknowledgeIncomplete: input.acknowledge_incomplete,
      confirmSummary: input.confirm_summary,
      isPartialScan: scan?.status === 'PARTIAL',
    });

    if (!eligibility.approvable) {
      throw new DomainError(
        'APPROVAL_INELIGIBLE',
        'Approval blocked',
        422,
        'errors.approval_ineligible',
        eligibility.blockingReasons.map((r) => ({ code: r })),
      );
    }

    const warnings = scan?.coverageJson ? JSON.parse(scan.coverageJson) : null;

    await getPrisma().$transaction(async (tx) => {
      const priorApproved = await tx.profileVersion.findFirst({
        where: tenantWhere(tenantId, { brandId, status: 'APPROVED' }),
      });
      if (priorApproved) {
        await tx.profileVersion.update({
          where: { id: priorApproved.id },
          data: { status: 'SUPERSEDED' },
        });
      }
      await tx.profileVersion.update({
        where: { id: versionId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedByUserId: actorUserId,
          incompletenessAcknowledged: input.acknowledge_incomplete,
          rowVersion: { increment: 1 },
        },
      });
      await tx.approvalRecord.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          profileVersionId: versionId,
          actorUserId,
          acknowledgedIncomplete: input.acknowledge_incomplete,
          warningsJson: warnings ? JSON.stringify(warnings) : null,
          coverageSnapshotJson: version.coverageSnapshotJson,
        },
      });
      await tx.brandWorkspace.update({
        where: { id: brandId },
        data: {
          currentApprovedProfileVersionId: versionId,
          status: 'ACTIVE',
        },
      });
      await tx.reviewDecision.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          profileVersionId: versionId,
          actorUserId,
          action: 'APPROVE_VERSION',
          acknowledgeIncomplete: input.acknowledge_incomplete,
          afterRef: input.reason,
          correlationId,
        },
      });
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.profile.approved',
      targetType: 'ProfileVersion',
      targetId: versionId,
      afterRef: warnings ? JSON.stringify(warnings) : undefined,
      correlationId,
    });

    return {
      data: {
        id: versionId,
        status: 'APPROVED',
        approved_at: new Date().toISOString(),
      },
    };
  }

  async reject(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    versionId: string,
    input: { row_version: number; reason?: string },
    correlationId?: string,
  ) {
    const version = await getPrisma().profileVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId }),
    });
    if (!version) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (!canApproveProfile(version.status as never) && version.status !== 'DRAFT') {
      throw new DomainError('CONFLICT_STATE', 'Not rejectable', 409, 'errors.conflict_state');
    }
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }

    await getPrisma().$transaction(async (tx) => {
      await tx.profileVersion.update({
        where: { id: versionId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedByUserId: actorUserId,
          rowVersion: { increment: 1 },
        },
      });
      await tx.reviewDecision.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          profileVersionId: versionId,
          actorUserId,
          action: 'REJECT_VERSION',
          afterRef: input.reason,
          correlationId,
        },
      });
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.profile.rejected',
      targetType: 'ProfileVersion',
      targetId: versionId,
      afterRef: input.reason,
      correlationId,
    });

    return { data: { id: versionId, status: 'REJECTED' } };
  }
}
