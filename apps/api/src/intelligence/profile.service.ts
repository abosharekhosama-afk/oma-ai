import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  canEditProfile,
  discoveryRowsToCatalogItems,
  discoveryTierForField,
  evaluateApprovalEligibility,
  isRequiredForApproval,
  mergeCatalogFieldValues,
  newId,
  parseCatalogFieldValue,
} from '@oma/domain';
import { notificationAllowed } from '@oma/domain';
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
        analysis_status: version.analysisStatus,
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
          confidence: i.confidence,
          created_by: i.createdBy,
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
      const actorPrefs = await tx.user.findUnique({
        where: { id: actorUserId },
        select: { preferencesJson: true },
      });
      if (
        version.status === 'DRAFT' &&
        notificationAllowed(actorPrefs?.preferencesJson, 'brand.profile.needs_review')
      ) {
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

  async mergeDiscoveryCatalog(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    versionId: string,
    input: {
      row_version: number;
      scan_id: string;
      discovery_item_ids: string[];
      accept_catalog_insights?: boolean;
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
    if (input.discovery_item_ids.length === 0) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'No discovery items',
        400,
        'errors.validation_failed',
      );
    }

    const scan = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { id: input.scan_id, brandId }),
    });
    if (!scan) throw new DomainError('NOT_FOUND', 'Scan not found', 404, 'errors.not_found');

    const rows = await getPrisma().discoveredProductService.findMany({
      where: tenantWhere(tenantId, {
        scanAttemptId: input.scan_id,
        id: { in: input.discovery_item_ids },
      }),
    });
    if (rows.length === 0) {
      throw new DomainError('NOT_FOUND', 'No matching items', 404, 'errors.not_found');
    }

    const productRows = rows.filter((r) => r.kind === 'PRODUCT');
    const serviceRows = rows.filter((r) => r.kind === 'SERVICE');
    const productAdditions = discoveryRowsToCatalogItems(productRows);
    const serviceAdditions = discoveryRowsToCatalogItems(serviceRows);

    const insights = await getPrisma().insightClaim.findMany({
      where: tenantWhere(tenantId, { profileVersionId: versionId }),
    });

    const sections = version.sectionsJson
      ? (JSON.parse(version.sectionsJson) as Record<string, unknown>)
      : {};
    const catalog = (
      typeof sections.catalog === 'object' && sections.catalog ? sections.catalog : {}
    ) as Record<string, unknown>;

    const mergeField = async (
      fieldKey: 'catalog.products' | 'catalog.services',
      additions: ReturnType<typeof discoveryRowsToCatalogItems>,
    ) => {
      if (additions.length === 0) return null;
      let insight = insights.find((i) => i.fieldKey === fieldKey);
      const existing = parseCatalogFieldValue(
        insight?.textValue,
        insight?.valueJson ? JSON.parse(insight.valueJson) : undefined,
      );
      const merged = mergeCatalogFieldValues(existing, additions);
      const serialized = JSON.stringify(merged);
      const sectionKey = fieldKey === 'catalog.products' ? 'products' : 'services';
      catalog[sectionKey] = merged;

      await getPrisma().$transaction(async (tx) => {
        const targetInsightId = insight?.id ?? newId();
        if (!insight) {
          await tx.insightClaim.create({
            data: {
              id: targetInsightId,
              tenantId,
              brandId,
              profileVersionId: versionId,
              fieldKey,
              infoState: 'USER_CORRECTED',
              reviewStatus: 'EDITED',
              textValue: serialized,
              valueJson: serialized,
              discoveryTier: discoveryTierForField(fieldKey) as never,
              createdBy: 'USER',
            },
          });
        } else {
          await tx.insightClaim.update({
            where: { id: targetInsightId },
            data: {
              textValue: serialized,
              valueJson: serialized,
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
              insightId: targetInsightId,
              actorUserId,
              action: 'EDIT',
              beforeRef: insight.textValue,
              afterRef: serialized,
              correlationId,
            },
          });
        }
        if (input.accept_catalog_insights) {
          await tx.insightClaim.update({
            where: { id: targetInsightId },
            data: {
              reviewStatus: 'ACCEPTED',
              infoState: 'USER_CONFIRMED',
              rowVersion: { increment: 1 },
            },
          });
          await tx.reviewDecision.create({
            data: {
              id: newId(),
              tenantId,
              brandId,
              profileVersionId: versionId,
              insightId: targetInsightId,
              actorUserId,
              action: 'ACCEPT',
              correlationId,
            },
          });
        }
      });
      return merged;
    };

    await mergeField('catalog.products', productAdditions);
    await mergeField('catalog.services', serviceAdditions);

    sections.catalog = catalog;
    await getPrisma().profileVersion.update({
      where: { id: versionId },
      data: {
        rowVersion: { increment: 1 },
        sectionsJson: JSON.stringify(sections),
        status: version.status === 'DRAFT' ? 'NEEDS_REVIEW' : version.status,
      },
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.profile.catalog_merged',
      targetType: 'ProfileVersion',
      targetId: versionId,
      correlationId,
    });

    return {
      data: {
        merged_item_count: rows.length,
        profile: (await this.get(tenantId, brandId, versionId)).data,
      },
    };
  }

  private async loadVersion(tenantId: string, brandId: string, versionId: string) {
    const version = await getPrisma().profileVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId }),
    });
    if (!version) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return version;
  }
}
