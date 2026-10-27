import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  aiAvailabilityToErrorCode,
  aiProposeHonestyMessage,
  canArchiveStrategy,
  canPatchVersionContent,
  evaluatePackageEligibility,
  evaluateSetCurrentEligibility,
  mustRefuseAiPropose,
  newId,
  shouldClearCurrentOnArchive,
} from '@oma/domain';
import { notificationAllowed } from '@oma/domain';
import { AuditService } from '../audit/audit.service';

type Tx = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0];

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function foundationHasRequired(foundationJson: string | null | undefined): boolean {
  const f = parseJson<Record<string, unknown>>(foundationJson, {});
  const goals = f.goals;
  const positioning = f.positioning;
  const hasGoals = Array.isArray(goals) ? goals.length > 0 : Boolean(goals);
  const hasPositioning =
    typeof positioning === 'string'
      ? positioning.trim().length > 0
      : Boolean(
          positioning &&
          typeof positioning === 'object' &&
          (positioning as { value?: string }).value,
        );
  return hasGoals && hasPositioning;
}

@Injectable()
export class StrategyService {
  constructor(private readonly audit: AuditService) {}

  private async requireBrand(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (brand.status === 'ARCHIVED') {
      throw new DomainError('BRAND_ARCHIVED', 'Brand archived', 409, 'errors.brand_archived');
    }
    return brand;
  }

  private async requireStrategy(tenantId: string, brandId: string, strategyId: string) {
    const strategy = await getPrisma().strategy.findFirst({
      where: tenantWhere(tenantId, { id: strategyId, brandId }),
    });
    if (!strategy) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return strategy;
  }

  private async requireVersion(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await getPrisma().strategyVersion.findFirst({
      where: tenantWhere(tenantId, { id: versionId, brandId, strategyId }),
    });
    if (!version) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return version;
  }

  private assertDraft(status: string) {
    if (!canPatchVersionContent(status as never)) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Version is immutable; revise to edit',
        409,
        'errors.conflict_state',
        [{ code: 'MUST_REVISE' }],
      );
    }
  }

  private async writeOutbox(
    tx: Tx,
    tenantId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    await tx.outboxEvent.create({
      data: {
        id: newId(),
        tenantId,
        eventType,
        payloadJson: JSON.stringify(payload),
      },
    });
  }

  private mapStrategyFlags(
    strategy: { id: string; status: string },
    brandCurrentId: string | null | undefined,
    approvedCount: number,
  ) {
    return {
      has_approved_version: approvedCount > 0,
      is_current: brandCurrentId === strategy.id,
    };
  }

  async list(tenantId: string, brandId: string) {
    const brand = await this.requireBrand(tenantId, brandId);
    const rows = await getPrisma().strategy.findMany({
      where: tenantWhere(tenantId, { brandId }),
      orderBy: { updatedAt: 'desc' },
    });
    const versionCounts = await getPrisma().strategyVersion.groupBy({
      by: ['strategyId'],
      where: { tenantId, brandId, status: 'APPROVED' },
      _count: { _all: true },
    });
    const approvedByStrategy = new Map(versionCounts.map((v) => [v.strategyId, v._count._all]));
    return {
      data: rows.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        version: s.version,
        ...this.mapStrategyFlags(
          s,
          brand.currentApprovedStrategyId,
          approvedByStrategy.get(s.id) ?? 0,
        ),
        updated_at: s.updatedAt.toISOString(),
        archived_at: s.archivedAt?.toISOString() ?? null,
      })),
    };
  }

  async create(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: {
      name: string;
      linked_approved_profile_version_id?: string | null;
      draft_profile_version_id?: string | null;
      organic_enabled?: boolean;
      paid_enabled?: boolean;
    },
    correlationId?: string,
  ) {
    await this.requireBrand(tenantId, brandId);
    const name = input.name?.trim();
    if (!name || name.length > 160) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid name', 400, 'errors.validation_failed');
    }

    const linkedApproved: string | null = input.linked_approved_profile_version_id ?? null;
    if (linkedApproved) {
      const profile = await getPrisma().profileVersion.findFirst({
        where: tenantWhere(tenantId, { id: linkedApproved, brandId, status: 'APPROVED' }),
      });
      if (!profile) {
        throw new DomainError(
          'VALIDATION_FAILED',
          'Approved profile version not found',
          400,
          'errors.validation_failed',
          [{ code: 'APPROVED_PROFILE_INVALID' }],
        );
      }
    }

    const strategyId = newId();
    const versionId = newId();
    await getPrisma().$transaction(async (tx) => {
      await tx.strategy.create({
        data: {
          id: strategyId,
          tenantId,
          brandId,
          name,
          createdByUserId: actorUserId,
        },
      });
      await tx.strategyVersion.create({
        data: {
          id: versionId,
          tenantId,
          brandId,
          strategyId,
          versionNumber: 1,
          linkedApprovedProfileVersionId: linkedApproved,
          draftProfileVersionId: input.draft_profile_version_id ?? null,
          organicEnabled: input.organic_enabled ?? true,
          paidEnabled: input.paid_enabled ?? false,
          paidDisabledRationale:
            (input.paid_enabled ?? false) ? null : 'Paid track not enabled for this draft',
          foundationJson: JSON.stringify({
            goals: [],
            positioning: { value: '', infoClass: 'USER_AUTHORED' },
            keyMessages: [],
            constraints: [],
          }),
        },
      });
      await tx.strategyOrganicTrack.create({
        data: { id: newId(), tenantId, brandId, strategyVersionId: versionId },
      });
      await tx.strategyPaidTrack.create({
        data: { id: newId(), tenantId, brandId, strategyVersionId: versionId },
      });
      await this.writeOutbox(tx, tenantId, 'strategy.created', {
        brandId,
        strategyId,
        versionId,
      });
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.created',
      targetType: 'Strategy',
      targetId: strategyId,
      correlationId,
    });

    return this.get(tenantId, brandId, strategyId);
  }

  async get(tenantId: string, brandId: string, strategyId: string) {
    const brand = await this.requireBrand(tenantId, brandId);
    const strategy = await this.requireStrategy(tenantId, brandId, strategyId);
    const versions = await getPrisma().strategyVersion.findMany({
      where: tenantWhere(tenantId, { strategyId }),
      orderBy: { versionNumber: 'desc' },
    });
    const latest = versions[0] ?? null;
    const approvedCount = versions.filter((v) => v.status === 'APPROVED').length;
    const missingSource = !latest?.linkedApprovedProfileVersionId;
    return {
      data: {
        id: strategy.id,
        name: strategy.name,
        status: strategy.status,
        version: strategy.version,
        origin_strategy_id: strategy.originStrategyId,
        ...this.mapStrategyFlags(strategy, brand.currentApprovedStrategyId, approvedCount),
        latest_version: latest
          ? {
              id: latest.id,
              status: latest.status,
              version_number: latest.versionNumber,
              row_version: latest.rowVersion,
              linked_approved_profile_version_id: latest.linkedApprovedProfileVersionId,
              draft_profile_version_id: latest.draftProfileVersionId,
              organic_enabled: latest.organicEnabled,
              paid_enabled: latest.paidEnabled,
              missing_source: missingSource,
              evidence_backed: Boolean(latest.linkedApprovedProfileVersionId),
              ai_availability: latest.aiAvailability,
            }
          : null,
        updated_at: strategy.updatedAt.toISOString(),
        archived_at: strategy.archivedAt?.toISOString() ?? null,
      },
    };
  }

  async patch(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    input: { name?: string; version: number },
    correlationId?: string,
  ) {
    const strategy = await this.requireStrategy(tenantId, brandId, strategyId);
    if (strategy.status === 'ARCHIVED') {
      throw new DomainError('CONFLICT_STATE', 'Strategy archived', 409, 'errors.conflict_state');
    }
    if (strategy.version !== input.version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    const updated = await getPrisma().strategy.update({
      where: { id: strategyId },
      data: {
        name: input.name?.trim() ?? strategy.name,
        version: { increment: 1 },
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.updated',
      targetType: 'Strategy',
      targetId: strategyId,
      correlationId,
    });
    return {
      data: {
        id: updated.id,
        name: updated.name,
        version: updated.version,
        status: updated.status,
      },
    };
  }

  async archive(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    input: { version: number; reason?: string },
    correlationId?: string,
  ) {
    const brand = await this.requireBrand(tenantId, brandId);
    const strategy = await this.requireStrategy(tenantId, brandId, strategyId);
    if (!canArchiveStrategy(strategy.status as never)) {
      throw new DomainError('CONFLICT_STATE', 'Already archived', 409, 'errors.conflict_state');
    }
    if (strategy.version !== input.version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    const clearPointer = shouldClearCurrentOnArchive(brand.currentApprovedStrategyId, strategyId);

    await getPrisma().$transaction(async (tx) => {
      await tx.strategy.update({
        where: { id: strategyId },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (clearPointer) {
        await tx.brandWorkspace.update({
          where: { id: brandId },
          data: {
            currentApprovedStrategyId: null,
            version: { increment: 1 },
          },
        });
        await this.writeOutbox(tx, tenantId, 'strategy.current_changed', {
          brandId,
          strategyId: null,
          reason: 'archive_clear',
        });
      }
      await this.writeOutbox(tx, tenantId, 'strategy.archived', { brandId, strategyId });
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.archived',
      targetType: 'Strategy',
      targetId: strategyId,
      afterRef: input.reason,
      correlationId,
    });
    if (clearPointer) {
      await this.audit.write({
        actorUserId,
        tenantId,
        action: 'strategy.current_cleared',
        targetType: 'BrandWorkspace',
        targetId: brandId,
        correlationId,
      });
    }
    return this.get(tenantId, brandId, strategyId);
  }

  async listVersions(tenantId: string, brandId: string, strategyId: string) {
    await this.requireStrategy(tenantId, brandId, strategyId);
    const versions = await getPrisma().strategyVersion.findMany({
      where: tenantWhere(tenantId, { strategyId, brandId }),
      orderBy: { versionNumber: 'desc' },
    });
    return {
      data: versions.map((v) => ({
        id: v.id,
        status: v.status,
        version_number: v.versionNumber,
        row_version: v.rowVersion,
        linked_approved_profile_version_id: v.linkedApprovedProfileVersionId,
        organic_enabled: v.organicEnabled,
        paid_enabled: v.paidEnabled,
        created_at: v.createdAt.toISOString(),
        approved_at: v.approvedAt?.toISOString() ?? null,
      })),
    };
  }

  async getVersion(tenantId: string, brandId: string, strategyId: string, versionId: string) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const [organic, paid, audiences, competitors, kpis, gaps, evidenceLinks, comments, approval] =
      await Promise.all([
        getPrisma().strategyOrganicTrack.findUnique({ where: { strategyVersionId: versionId } }),
        getPrisma().strategyPaidTrack.findUnique({ where: { strategyVersionId: versionId } }),
        getPrisma().strategyAudience.findMany({
          where: { strategyVersionId: versionId },
          orderBy: { sortOrder: 'asc' },
        }),
        getPrisma().strategyCompetitorReference.findMany({
          where: { strategyVersionId: versionId },
        }),
        getPrisma().strategyKpi.findMany({ where: { strategyVersionId: versionId } }),
        getPrisma().strategyRiskAssumptionDependency.findMany({
          where: { strategyVersionId: versionId },
        }),
        getPrisma().strategyEvidenceLink.findMany({ where: { strategyVersionId: versionId } }),
        getPrisma().strategyComment.findMany({
          where: { strategyVersionId: versionId },
          orderBy: { createdAt: 'asc' },
        }),
        getPrisma().strategyApprovalRecord.findUnique({ where: { strategyVersionId: versionId } }),
      ]);

    return {
      data: {
        id: version.id,
        strategy_id: version.strategyId,
        status: version.status,
        version_number: version.versionNumber,
        row_version: version.rowVersion,
        linked_approved_profile_version_id: version.linkedApprovedProfileVersionId,
        draft_profile_version_id: version.draftProfileVersionId,
        organic_enabled: version.organicEnabled,
        paid_enabled: version.paidEnabled,
        organic_disabled_rationale: version.organicDisabledRationale,
        paid_disabled_rationale: version.paidDisabledRationale,
        ai_availability: version.aiAvailability,
        foundation: parseJson(version.foundationJson, {}),
        unknowns_acknowledged: version.unknownsAcknowledged,
        missing_source: !version.linkedApprovedProfileVersionId,
        evidence_backed: Boolean(version.linkedApprovedProfileVersionId),
        organic: organic
          ? {
              id: organic.id,
              row_version: organic.rowVersion,
              planning_only: true,
              pillars: parseJson(organic.pillarsJson, []),
              channels: parseJson(organic.channelsJson, []),
              formats: parseJson(organic.formatsJson, []),
              frequency: organic.frequency,
              community_goals: organic.communityGoals,
              growth_goals: organic.growthGoals,
              message_cta: organic.messageCta,
              funnel_stages: parseJson(organic.funnelStagesJson, []),
              kpis: parseJson(organic.kpisJson, []),
              owner_role_labels: parseJson(organic.ownerRoleLabelsJson, []),
              dependencies: parseJson(organic.dependenciesJson, []),
            }
          : null,
        paid: paid
          ? {
              id: paid.id,
              row_version: paid.rowVersion,
              planning_only: true,
              campaign_objectives: parseJson(paid.campaignObjectivesJson, []),
              funnel_stages: parseJson(paid.funnelStagesJson, []),
              audiences: parseJson(paid.audiencesJson, []),
              offer_angle: paid.offerAngle,
              formats: parseJson(paid.formatsJson, []),
              placements: parseJson(paid.placementsJson, []),
              budget_amount: paid.budgetAmount?.toString() ?? null,
              budget_currency: paid.budgetCurrency,
              allocation: parseJson(paid.allocationJson, {}),
              expected_kpis: parseJson(paid.expectedKpisJson, []),
              schedule_window_start: paid.scheduleWindowStart?.toISOString() ?? null,
              schedule_window_end: paid.scheduleWindowEnd?.toISOString() ?? null,
              landing_destination: paid.landingDestination,
              approval_notes: paid.approvalNotes,
            }
          : null,
        audiences: audiences.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          info_class: a.infoClass,
          sort_order: a.sortOrder,
        })),
        competitors: competitors.map((c) => ({
          id: c.id,
          title: c.title,
          source_url: c.sourceUrl,
          source_note: c.sourceNote,
          captured_at: c.capturedAt?.toISOString() ?? null,
          uncertainty: c.uncertainty,
          info_class: c.infoClass,
        })),
        kpis: kpis.map((k) => ({
          id: k.id,
          name: k.name,
          target_value: k.targetValue,
          unit: k.unit,
          applies_to: k.appliesTo,
          info_class: k.infoClass,
        })),
        gaps: gaps.map((g) => ({
          id: g.id,
          kind: g.kind,
          text: g.text,
          info_class: g.infoClass,
        })),
        evidence_links: evidenceLinks.map((e) => ({
          id: e.id,
          evidence_excerpt_id: e.evidenceExcerptId,
          profile_field_key: e.profileFieldKey,
          label: e.label,
          created_at: e.createdAt.toISOString(),
        })),
        comments: comments.map((c) => ({
          id: c.id,
          actor_user_id: c.actorUserId,
          body: c.body,
          anchor_path: c.anchorPath,
          created_at: c.createdAt.toISOString(),
        })),
        approval: approval
          ? {
              id: approval.id,
              actor_user_id: approval.actorUserId,
              linked_approved_profile_version_id: approval.linkedApprovedProfileVersionId,
              organic_enabled: approval.organicEnabled,
              paid_enabled: approval.paidEnabled,
              comment: approval.comment,
              created_at: approval.createdAt.toISOString(),
            }
          : null,
      },
    };
  }

  async patchVersion(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: {
      row_version: number;
      foundation?: Record<string, unknown>;
      unknowns_acknowledged?: boolean;
    },
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    this.assertDraft(version.status);
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }

    const before = version.foundationJson;
    const foundationJson = input.foundation
      ? JSON.stringify(input.foundation)
      : version.foundationJson;

    await getPrisma().$transaction(async (tx) => {
      await tx.strategyVersion.update({
        where: { id: versionId },
        data: {
          foundationJson,
          unknownsAcknowledged: input.unknowns_acknowledged ?? version.unknownsAcknowledged,
          rowVersion: { increment: 1 },
        },
      });
      if (input.foundation) {
        await tx.strategyHumanEdit.create({
          data: {
            id: newId(),
            tenantId,
            brandId,
            strategyVersionId: versionId,
            actorUserId,
            fieldPath: 'foundation',
            beforeRef: before,
            afterRef: foundationJson,
            correlationId,
          },
        });
      }
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.foundation_patched',
      targetType: 'StrategyVersion',
      targetId: versionId,
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, versionId);
  }

  async linkProfile(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { profile_version_id: string; role: 'approved' | 'draft_aid'; row_version: number },
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    this.assertDraft(version.status);
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    const profile = await getPrisma().profileVersion.findFirst({
      where: tenantWhere(tenantId, { id: input.profile_version_id, brandId }),
    });
    if (!profile) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (input.role === 'approved' && profile.status !== 'APPROVED') {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Profile must be APPROVED for approved linkage',
        400,
        'errors.validation_failed',
        [{ code: 'PROFILE_NOT_APPROVED' }],
      );
    }

    await getPrisma().strategyVersion.update({
      where: { id: versionId },
      data: {
        linkedApprovedProfileVersionId:
          input.role === 'approved' ? profile.id : version.linkedApprovedProfileVersionId,
        draftProfileVersionId:
          input.role === 'draft_aid' ? profile.id : version.draftProfileVersionId,
        rowVersion: { increment: 1 },
      },
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.profile_linked',
      targetType: 'StrategyVersion',
      targetId: versionId,
      afterRef: JSON.stringify({ role: input.role, profileVersionId: profile.id }),
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, versionId);
  }

  async setTrackEnablement(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: {
      row_version: number;
      organic_enabled: boolean;
      paid_enabled: boolean;
      organic_disabled_rationale?: string | null;
      paid_disabled_rationale?: string | null;
    },
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    this.assertDraft(version.status);
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    await getPrisma().strategyVersion.update({
      where: { id: versionId },
      data: {
        organicEnabled: input.organic_enabled,
        paidEnabled: input.paid_enabled,
        organicDisabledRationale: input.organic_disabled_rationale ?? null,
        paidDisabledRationale: input.paid_disabled_rationale ?? null,
        rowVersion: { increment: 1 },
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.track_enablement_changed',
      targetType: 'StrategyVersion',
      targetId: versionId,
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, versionId);
  }

  async patchOrganic(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: Record<string, unknown> & { row_version: number },
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    this.assertDraft(version.status);
    const track = await getPrisma().strategyOrganicTrack.findUnique({
      where: { strategyVersionId: versionId },
    });
    if (!track) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (track.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    await getPrisma().strategyOrganicTrack.update({
      where: { id: track.id },
      data: {
        pillarsJson:
          input.pillars !== undefined ? JSON.stringify(input.pillars) : track.pillarsJson,
        channelsJson:
          input.channels !== undefined ? JSON.stringify(input.channels) : track.channelsJson,
        formatsJson:
          input.formats !== undefined ? JSON.stringify(input.formats) : track.formatsJson,
        frequency: (input.frequency as string | undefined) ?? track.frequency,
        communityGoals: (input.community_goals as string | undefined) ?? track.communityGoals,
        growthGoals: (input.growth_goals as string | undefined) ?? track.growthGoals,
        messageCta: (input.message_cta as string | undefined) ?? track.messageCta,
        funnelStagesJson:
          input.funnel_stages !== undefined
            ? JSON.stringify(input.funnel_stages)
            : track.funnelStagesJson,
        kpisJson: input.kpis !== undefined ? JSON.stringify(input.kpis) : track.kpisJson,
        ownerRoleLabelsJson:
          input.owner_role_labels !== undefined
            ? JSON.stringify(input.owner_role_labels)
            : track.ownerRoleLabelsJson,
        dependenciesJson:
          input.dependencies !== undefined
            ? JSON.stringify(input.dependencies)
            : track.dependenciesJson,
        rowVersion: { increment: 1 },
      },
    });
    await getPrisma().strategyVersion.update({
      where: { id: versionId },
      data: { rowVersion: { increment: 1 } },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.organic_patched',
      targetType: 'StrategyOrganicTrack',
      targetId: track.id,
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, versionId);
  }

  async patchPaid(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: Record<string, unknown> & { row_version: number },
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    this.assertDraft(version.status);
    const track = await getPrisma().strategyPaidTrack.findUnique({
      where: { strategyVersionId: versionId },
    });
    if (!track) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (track.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    // Reject live provider ids if mistakenly sent
    for (const forbidden of [
      'ad_account_id',
      'pixel_id',
      'provider_campaign_id',
      'meta_campaign_id',
    ]) {
      if (input[forbidden] != null) {
        throw new DomainError(
          'VALIDATION_FAILED',
          'Paid track is planning-only; provider ids forbidden',
          400,
          'errors.validation_failed',
          [{ code: 'PAID_PLANNING_ONLY', field: forbidden }],
        );
      }
    }
    await getPrisma().strategyPaidTrack.update({
      where: { id: track.id },
      data: {
        campaignObjectivesJson:
          input.campaign_objectives !== undefined
            ? JSON.stringify(input.campaign_objectives)
            : track.campaignObjectivesJson,
        funnelStagesJson:
          input.funnel_stages !== undefined
            ? JSON.stringify(input.funnel_stages)
            : track.funnelStagesJson,
        audiencesJson:
          input.audiences !== undefined ? JSON.stringify(input.audiences) : track.audiencesJson,
        offerAngle: (input.offer_angle as string | undefined) ?? track.offerAngle,
        formatsJson:
          input.formats !== undefined ? JSON.stringify(input.formats) : track.formatsJson,
        placementsJson:
          input.placements !== undefined ? JSON.stringify(input.placements) : track.placementsJson,
        budgetAmount:
          input.budget_amount !== undefined
            ? (input.budget_amount as string | number | null)
            : track.budgetAmount,
        budgetCurrency: (input.budget_currency as string | undefined) ?? track.budgetCurrency,
        allocationJson:
          input.allocation !== undefined ? JSON.stringify(input.allocation) : track.allocationJson,
        expectedKpisJson:
          input.expected_kpis !== undefined
            ? JSON.stringify(input.expected_kpis)
            : track.expectedKpisJson,
        scheduleWindowStart:
          input.schedule_window_start !== undefined
            ? input.schedule_window_start
              ? new Date(String(input.schedule_window_start))
              : null
            : track.scheduleWindowStart,
        scheduleWindowEnd:
          input.schedule_window_end !== undefined
            ? input.schedule_window_end
              ? new Date(String(input.schedule_window_end))
              : null
            : track.scheduleWindowEnd,
        landingDestination:
          (input.landing_destination as string | undefined) ?? track.landingDestination,
        approvalNotes: (input.approval_notes as string | undefined) ?? track.approvalNotes,
        rowVersion: { increment: 1 },
      },
    });
    await getPrisma().strategyVersion.update({
      where: { id: versionId },
      data: { rowVersion: { increment: 1 } },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.paid_patched',
      targetType: 'StrategyPaidTrack',
      targetId: track.id,
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, versionId);
  }

  private async assertDraftChild(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    this.assertDraft(version.status);
    return version;
  }

  async createAudience(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { name: string; description?: string; info_class?: string; sort_order?: number },
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyAudience.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        strategyVersionId: versionId,
        name: input.name.trim(),
        description: input.description ?? null,
        infoClass: (input.info_class as never) ?? 'USER_AUTHORED',
        sortOrder: input.sort_order ?? 0,
      },
    });
    return { data: { id: row.id, name: row.name, info_class: row.infoClass } };
  }

  async deleteAudience(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    audienceId: string,
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyAudience.findFirst({
      where: tenantWhere(tenantId, { id: audienceId, strategyVersionId: versionId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    await getPrisma().strategyAudience.delete({ where: { id: audienceId } });
    return { data: { id: audienceId, deleted: true } };
  }

  async createCompetitor(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: {
      title: string;
      source_url?: string;
      source_note?: string;
      captured_at?: string;
      uncertainty?: string;
      info_class?: string;
    },
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyCompetitorReference.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        strategyVersionId: versionId,
        title: input.title.trim(),
        sourceUrl: input.source_url ?? null,
        sourceNote: input.source_note ?? null,
        capturedAt: input.captured_at ? new Date(input.captured_at) : new Date(),
        uncertainty: input.uncertainty ?? null,
        infoClass: (input.info_class as never) ?? 'USER_AUTHORED',
      },
    });
    return { data: { id: row.id, title: row.title } };
  }

  async deleteCompetitor(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    competitorId: string,
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyCompetitorReference.findFirst({
      where: tenantWhere(tenantId, { id: competitorId, strategyVersionId: versionId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    await getPrisma().strategyCompetitorReference.delete({ where: { id: competitorId } });
    return { data: { id: competitorId, deleted: true } };
  }

  async createKpi(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: {
      name: string;
      target_value?: string;
      unit?: string;
      applies_to?: string;
      info_class?: string;
    },
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyKpi.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        strategyVersionId: versionId,
        name: input.name.trim(),
        targetValue: input.target_value ?? null,
        unit: input.unit ?? null,
        appliesTo: (input.applies_to as never) ?? 'STRATEGY',
        infoClass: (input.info_class as never) ?? 'USER_AUTHORED',
      },
    });
    return { data: { id: row.id, name: row.name } };
  }

  async deleteKpi(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    kpiId: string,
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyKpi.findFirst({
      where: tenantWhere(tenantId, { id: kpiId, strategyVersionId: versionId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    await getPrisma().strategyKpi.delete({ where: { id: kpiId } });
    return { data: { id: kpiId, deleted: true } };
  }

  async createGap(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { kind: string; text: string; info_class?: string },
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyRiskAssumptionDependency.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        strategyVersionId: versionId,
        kind: input.kind as never,
        text: input.text.trim(),
        infoClass: (input.info_class as never) ?? 'ASSUMPTION',
      },
    });
    return { data: { id: row.id, kind: row.kind, text: row.text } };
  }

  async deleteGap(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    gapId: string,
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyRiskAssumptionDependency.findFirst({
      where: tenantWhere(tenantId, { id: gapId, strategyVersionId: versionId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    await getPrisma().strategyRiskAssumptionDependency.delete({ where: { id: gapId } });
    return { data: { id: gapId, deleted: true } };
  }

  async createEvidenceLink(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { evidence_excerpt_id?: string; profile_field_key?: string; label?: string },
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    if (input.evidence_excerpt_id) {
      const excerpt = await getPrisma().evidenceExcerpt.findFirst({
        where: tenantWhere(tenantId, { id: input.evidence_excerpt_id, brandId }),
      });
      if (!excerpt) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    }
    const row = await getPrisma().strategyEvidenceLink.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        strategyVersionId: versionId,
        evidenceExcerptId: input.evidence_excerpt_id ?? null,
        profileFieldKey: input.profile_field_key ?? null,
        label: input.label ?? null,
        createdByUserId: actorUserId,
      },
    });
    return { data: { id: row.id } };
  }

  async deleteEvidenceLink(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    linkId: string,
  ) {
    await this.assertDraftChild(tenantId, brandId, strategyId, versionId);
    const row = await getPrisma().strategyEvidenceLink.findFirst({
      where: tenantWhere(tenantId, { id: linkId, strategyVersionId: versionId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    await getPrisma().strategyEvidenceLink.delete({ where: { id: linkId } });
    return { data: { id: linkId, deleted: true } };
  }

  async openEvidenceLink(
    tenantId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    linkId: string,
  ) {
    await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const link = await getPrisma().strategyEvidenceLink.findFirst({
      where: tenantWhere(tenantId, { id: linkId, strategyVersionId: versionId, brandId }),
    });
    if (!link) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (!link.evidenceExcerptId) {
      return { data: { id: link.id, excerpt: null, label: link.label } };
    }
    const excerpt = await getPrisma().evidenceExcerpt.findFirst({
      where: tenantWhere(tenantId, { id: link.evidenceExcerptId, brandId }),
    });
    if (!excerpt) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return {
      data: {
        id: link.id,
        label: link.label,
        excerpt: {
          id: excerpt.id,
          source_url: excerpt.sourceUrl,
          excerpt_text: excerpt.excerptText,
          page_title: excerpt.pageTitle,
        },
      },
    };
  }

  async submit(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { row_version: number; unknowns_acknowledged?: boolean },
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    if (version.status !== 'DRAFT') {
      throw new DomainError('CONFLICT_STATE', 'Not draft', 409, 'errors.conflict_state');
    }
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    let linkedStatus: string | null = null;
    if (version.linkedApprovedProfileVersionId) {
      const profile = await getPrisma().profileVersion.findFirst({
        where: tenantWhere(tenantId, {
          id: version.linkedApprovedProfileVersionId,
          brandId,
        }),
      });
      linkedStatus = profile?.status ?? null;
    }
    const eligibility = evaluatePackageEligibility({
      linkedApprovedProfileVersionId: version.linkedApprovedProfileVersionId,
      linkedProfileStatus: linkedStatus,
      organicEnabled: version.organicEnabled,
      paidEnabled: version.paidEnabled,
      organicDisabledRationale: version.organicDisabledRationale,
      paidDisabledRationale: version.paidDisabledRationale,
      requiredFoundationPresent: foundationHasRequired(version.foundationJson),
      unknownsAcknowledged: input.unknowns_acknowledged ?? version.unknownsAcknowledged,
      forAction: 'submit',
    });
    if (!eligibility.eligible) {
      throw new DomainError(
        'APPROVAL_INELIGIBLE',
        'Submit blocked',
        422,
        'errors.approval_ineligible',
        eligibility.blockingReasons.map((r) => ({ code: r })),
      );
    }

    await getPrisma().$transaction(async (tx) => {
      await tx.strategyVersion.update({
        where: { id: versionId },
        data: {
          status: 'IN_REVIEW',
          unknownsAcknowledged: true,
          submittedAt: new Date(),
          submittedByUserId: actorUserId,
          rowVersion: { increment: 1 },
        },
      });
      await tx.strategyReviewDecision.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: versionId,
          actorUserId,
          action: 'SUBMIT',
          capabilityCode: 'strategy.submit',
          correlationId,
        },
      });
      await this.writeOutbox(tx, tenantId, 'strategy.submitted', {
        brandId,
        strategyId,
        versionId,
      });
      const actorPrefs = await tx.user.findUnique({
        where: { id: actorUserId },
        select: { preferencesJson: true },
      });
      if (notificationAllowed(actorPrefs?.preferencesJson, 'strategy.submitted'))
      await tx.notification.create({
        data: {
          id: newId(),
          tenantId,
          recipientUserId: actorUserId,
          type: 'strategy.submitted',
          objectType: 'StrategyVersion',
          objectId: versionId,
          deepLinkPath: `/app/brands/${brandId}/strategies/${strategyId}/review`,
          dedupeKey: `strategy.submitted:${versionId}:${newId().slice(-6)}`,
        },
      });
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.submitted',
      targetType: 'StrategyVersion',
      targetId: versionId,
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, versionId);
  }

  async approvePackage(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { row_version: number; comment?: string; unknowns_acknowledged: boolean },
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    if (version.status !== 'IN_REVIEW') {
      throw new DomainError('CONFLICT_STATE', 'Not in review', 409, 'errors.conflict_state');
    }
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    if (!input.unknowns_acknowledged) {
      throw new DomainError(
        'APPROVAL_INELIGIBLE',
        'Unknowns must be acknowledged',
        422,
        'errors.approval_ineligible',
        [{ code: 'UNKNOWNS_ACK_REQUIRED' }],
      );
    }
    const profile = version.linkedApprovedProfileVersionId
      ? await getPrisma().profileVersion.findFirst({
          where: tenantWhere(tenantId, {
            id: version.linkedApprovedProfileVersionId,
            brandId,
          }),
        })
      : null;
    const eligibility = evaluatePackageEligibility({
      linkedApprovedProfileVersionId: version.linkedApprovedProfileVersionId,
      linkedProfileStatus: profile?.status ?? null,
      organicEnabled: version.organicEnabled,
      paidEnabled: version.paidEnabled,
      organicDisabledRationale: version.organicDisabledRationale,
      paidDisabledRationale: version.paidDisabledRationale,
      requiredFoundationPresent: foundationHasRequired(version.foundationJson),
      unknownsAcknowledged: true,
      forAction: 'approve',
    });
    if (!eligibility.eligible) {
      throw new DomainError(
        'APPROVAL_INELIGIBLE',
        'Approve blocked',
        422,
        'errors.approval_ineligible',
        eligibility.blockingReasons.map((r) => ({ code: r })),
      );
    }

    await getPrisma().$transaction(async (tx) => {
      const priorApproved = await tx.strategyVersion.findMany({
        where: tenantWhere(tenantId, { strategyId, status: 'APPROVED' }),
      });
      for (const prior of priorApproved) {
        await tx.strategyVersion.update({
          where: { id: prior.id },
          data: { status: 'SUPERSEDED' },
        });
      }
      await tx.strategyVersion.update({
        where: { id: versionId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedByUserId: actorUserId,
          unknownsAcknowledged: true,
          rowVersion: { increment: 1 },
        },
      });
      await tx.strategyApprovalRecord.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: versionId,
          actorUserId,
          capabilityCode: 'strategy.approve',
          linkedApprovedProfileVersionId: version.linkedApprovedProfileVersionId!,
          organicEnabled: version.organicEnabled,
          paidEnabled: version.paidEnabled,
          comment: input.comment ?? null,
          unknownsAcknowledged: true,
        },
      });
      await tx.strategyReviewDecision.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: versionId,
          actorUserId,
          action: 'APPROVE_PACKAGE',
          comment: input.comment ?? null,
          capabilityCode: 'strategy.approve',
          correlationId,
        },
      });
      await this.writeOutbox(tx, tenantId, 'strategy.approved', {
        brandId,
        strategyId,
        versionId,
        // Explicit: never set current on approve
        current_auto_set: false,
      });
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.approved_package',
      targetType: 'StrategyVersion',
      targetId: versionId,
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, versionId);
  }

  async requestChanges(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { row_version: number; comment?: string },
    correlationId?: string,
  ) {
    return this.reviewDecision(
      tenantId,
      actorUserId,
      brandId,
      strategyId,
      versionId,
      input,
      'CHANGES_REQUESTED',
      'REQUEST_CHANGES',
      'strategy.changes_requested',
      correlationId,
    );
  }

  async reject(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { row_version: number; comment?: string },
    correlationId?: string,
  ) {
    return this.reviewDecision(
      tenantId,
      actorUserId,
      brandId,
      strategyId,
      versionId,
      input,
      'REJECTED',
      'REJECT',
      'strategy.rejected',
      correlationId,
    );
  }

  private async reviewDecision(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { row_version: number; comment?: string },
    toStatus: 'CHANGES_REQUESTED' | 'REJECTED',
    action: 'REQUEST_CHANGES' | 'REJECT',
    auditAction: string,
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    if (version.status !== 'IN_REVIEW') {
      throw new DomainError('CONFLICT_STATE', 'Not in review', 409, 'errors.conflict_state');
    }
    if (version.rowVersion !== input.row_version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    await getPrisma().$transaction(async (tx) => {
      await tx.strategyVersion.update({
        where: { id: versionId },
        data: {
          status: toStatus,
          rejectedAt: toStatus === 'REJECTED' ? new Date() : undefined,
          rejectedByUserId: toStatus === 'REJECTED' ? actorUserId : undefined,
          rowVersion: { increment: 1 },
        },
      });
      await tx.strategyReviewDecision.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: versionId,
          actorUserId,
          action,
          comment: input.comment ?? null,
          capabilityCode: 'strategy.approve',
          correlationId,
        },
      });
      await this.writeOutbox(tx, tenantId, auditAction, { brandId, strategyId, versionId });
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: auditAction,
      targetType: 'StrategyVersion',
      targetId: versionId,
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, versionId);
  }

  async addComment(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { body: string; anchor_path?: string },
    correlationId?: string,
  ) {
    await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const body = input.body?.trim();
    if (!body) {
      throw new DomainError('VALIDATION_FAILED', 'Empty comment', 400, 'errors.validation_failed');
    }
    const row = await getPrisma().strategyComment.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        strategyVersionId: versionId,
        actorUserId,
        body,
        anchorPath: input.anchor_path ?? null,
      },
    });
    await getPrisma().strategyReviewDecision.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        strategyVersionId: versionId,
        actorUserId,
        action: 'COMMENT',
        comment: body,
        capabilityCode: 'strategy.comment',
        correlationId,
      },
    });
    await getPrisma().outboxEvent.create({
      data: {
        id: newId(),
        tenantId,
        eventType: 'strategy.comment_added',
        payloadJson: JSON.stringify({ brandId, strategyId, versionId, commentId: row.id }),
      },
    });
    return {
      data: {
        id: row.id,
        body: row.body,
        created_at: row.createdAt.toISOString(),
      },
    };
  }

  async listComments(tenantId: string, brandId: string, strategyId: string, versionId: string) {
    await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const rows = await getPrisma().strategyComment.findMany({
      where: tenantWhere(tenantId, { strategyVersionId: versionId, brandId }),
      orderBy: { createdAt: 'asc' },
    });
    return {
      data: rows.map((c) => ({
        id: c.id,
        actor_user_id: c.actorUserId,
        body: c.body,
        anchor_path: c.anchorPath,
        created_at: c.createdAt.toISOString(),
      })),
    };
  }

  async listDecisions(tenantId: string, brandId: string, strategyId: string, versionId: string) {
    await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const rows = await getPrisma().strategyReviewDecision.findMany({
      where: tenantWhere(tenantId, { strategyVersionId: versionId, brandId }),
      orderBy: { createdAt: 'asc' },
    });
    return {
      data: rows.map((d) => ({
        id: d.id,
        action: d.action,
        comment: d.comment,
        actor_user_id: d.actorUserId,
        created_at: d.createdAt.toISOString(),
      })),
    };
  }

  async getApproval(tenantId: string, brandId: string, strategyId: string, versionId: string) {
    await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const approval = await getPrisma().strategyApprovalRecord.findUnique({
      where: { strategyVersionId: versionId },
    });
    if (!approval) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return {
      data: {
        id: approval.id,
        actor_user_id: approval.actorUserId,
        linked_approved_profile_version_id: approval.linkedApprovedProfileVersionId,
        organic_enabled: approval.organicEnabled,
        paid_enabled: approval.paidEnabled,
        comment: approval.comment,
        created_at: approval.createdAt.toISOString(),
      },
    };
  }

  private async copyPackageToNewDraft(
    tx: Tx,
    tenantId: string,
    brandId: string,
    strategyId: string,
    sourceVersionId: string,
    actorUserId: string,
    nextNumber: number,
  ) {
    const source = await tx.strategyVersion.findFirstOrThrow({
      where: { id: sourceVersionId },
    });
    const newVersionId = newId();
    await tx.strategyVersion.create({
      data: {
        id: newVersionId,
        tenantId,
        brandId,
        strategyId,
        status: 'DRAFT',
        versionNumber: nextNumber,
        linkedApprovedProfileVersionId: source.linkedApprovedProfileVersionId,
        draftProfileVersionId: source.draftProfileVersionId,
        organicEnabled: source.organicEnabled,
        paidEnabled: source.paidEnabled,
        organicDisabledRationale: source.organicDisabledRationale,
        paidDisabledRationale: source.paidDisabledRationale,
        foundationJson: source.foundationJson,
        unknownsAcknowledged: false,
        supersedesVersionId: sourceVersionId,
        aiAvailability: 'NOT_CONFIGURED',
      },
    });
    const organic = await tx.strategyOrganicTrack.findUnique({
      where: { strategyVersionId: sourceVersionId },
    });
    if (organic) {
      await tx.strategyOrganicTrack.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: newVersionId,
          pillarsJson: organic.pillarsJson,
          channelsJson: organic.channelsJson,
          formatsJson: organic.formatsJson,
          frequency: organic.frequency,
          communityGoals: organic.communityGoals,
          growthGoals: organic.growthGoals,
          messageCta: organic.messageCta,
          funnelStagesJson: organic.funnelStagesJson,
          kpisJson: organic.kpisJson,
          ownerRoleLabelsJson: organic.ownerRoleLabelsJson,
          dependenciesJson: organic.dependenciesJson,
        },
      });
    } else {
      await tx.strategyOrganicTrack.create({
        data: { id: newId(), tenantId, brandId, strategyVersionId: newVersionId },
      });
    }
    const paid = await tx.strategyPaidTrack.findUnique({
      where: { strategyVersionId: sourceVersionId },
    });
    if (paid) {
      await tx.strategyPaidTrack.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: newVersionId,
          campaignObjectivesJson: paid.campaignObjectivesJson,
          funnelStagesJson: paid.funnelStagesJson,
          audiencesJson: paid.audiencesJson,
          offerAngle: paid.offerAngle,
          formatsJson: paid.formatsJson,
          placementsJson: paid.placementsJson,
          budgetAmount: paid.budgetAmount,
          budgetCurrency: paid.budgetCurrency,
          allocationJson: paid.allocationJson,
          expectedKpisJson: paid.expectedKpisJson,
          scheduleWindowStart: paid.scheduleWindowStart,
          scheduleWindowEnd: paid.scheduleWindowEnd,
          landingDestination: paid.landingDestination,
          approvalNotes: paid.approvalNotes,
        },
      });
    } else {
      await tx.strategyPaidTrack.create({
        data: { id: newId(), tenantId, brandId, strategyVersionId: newVersionId },
      });
    }

    const audiences = await tx.strategyAudience.findMany({
      where: { strategyVersionId: sourceVersionId },
    });
    for (const a of audiences) {
      await tx.strategyAudience.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: newVersionId,
          name: a.name,
          description: a.description,
          infoClass: a.infoClass,
          sortOrder: a.sortOrder,
        },
      });
    }
    const competitors = await tx.strategyCompetitorReference.findMany({
      where: { strategyVersionId: sourceVersionId },
    });
    for (const c of competitors) {
      await tx.strategyCompetitorReference.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: newVersionId,
          title: c.title,
          sourceUrl: c.sourceUrl,
          sourceNote: c.sourceNote,
          capturedAt: c.capturedAt,
          uncertainty: c.uncertainty,
          infoClass: c.infoClass,
        },
      });
    }
    const kpis = await tx.strategyKpi.findMany({ where: { strategyVersionId: sourceVersionId } });
    for (const k of kpis) {
      await tx.strategyKpi.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: newVersionId,
          name: k.name,
          targetValue: k.targetValue,
          unit: k.unit,
          appliesTo: k.appliesTo,
          infoClass: k.infoClass,
        },
      });
    }
    const gaps = await tx.strategyRiskAssumptionDependency.findMany({
      where: { strategyVersionId: sourceVersionId },
    });
    for (const g of gaps) {
      await tx.strategyRiskAssumptionDependency.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: newVersionId,
          kind: g.kind,
          text: g.text,
          infoClass: g.infoClass,
        },
      });
    }
    const links = await tx.strategyEvidenceLink.findMany({
      where: { strategyVersionId: sourceVersionId },
    });
    for (const e of links) {
      await tx.strategyEvidenceLink.create({
        data: {
          id: newId(),
          tenantId,
          brandId,
          strategyVersionId: newVersionId,
          evidenceExcerptId: e.evidenceExcerptId,
          profileFieldKey: e.profileFieldKey,
          label: e.label,
          createdByUserId: actorUserId,
        },
      });
    }
    return newVersionId;
  }

  async revise(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    correlationId?: string,
  ) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    if (!['CHANGES_REQUESTED', 'REJECTED', 'APPROVED'].includes(version.status)) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Cannot revise from status',
        409,
        'errors.conflict_state',
      );
    }
    const max = await getPrisma().strategyVersion.aggregate({
      where: { strategyId },
      _max: { versionNumber: true },
    });
    const nextNumber = (max._max.versionNumber ?? 0) + 1;
    let newVersionId = '';
    await getPrisma().$transaction(async (tx) => {
      newVersionId = await this.copyPackageToNewDraft(
        tx,
        tenantId,
        brandId,
        strategyId,
        versionId,
        actorUserId,
        nextNumber,
      );
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.revised',
      targetType: 'StrategyVersion',
      targetId: newVersionId,
      correlationId,
    });
    return this.getVersion(tenantId, brandId, strategyId, newVersionId);
  }

  async fromApproved(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    input: { source_version_id?: string },
    correlationId?: string,
  ) {
    const source =
      (input.source_version_id
        ? await getPrisma().strategyVersion.findFirst({
            where: tenantWhere(tenantId, {
              id: input.source_version_id,
              strategyId,
              brandId,
              status: 'APPROVED',
            }),
          })
        : await getPrisma().strategyVersion.findFirst({
            where: tenantWhere(tenantId, { strategyId, brandId, status: 'APPROVED' }),
            orderBy: { versionNumber: 'desc' },
          })) ?? null;
    if (!source) throw new DomainError('NOT_FOUND', 'No approved version', 404, 'errors.not_found');
    return this.revise(tenantId, actorUserId, brandId, strategyId, source.id, correlationId);
  }

  async clone(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    strategyId: string,
    versionId: string,
    input: { name?: string },
    correlationId?: string,
  ) {
    await this.requireVersion(tenantId, brandId, strategyId, versionId);
    const sourceStrategy = await this.requireStrategy(tenantId, brandId, strategyId);
    const newStrategyId = newId();
    await getPrisma().$transaction(async (tx) => {
      await tx.strategy.create({
        data: {
          id: newStrategyId,
          tenantId,
          brandId,
          name: input.name?.trim() || `${sourceStrategy.name} (copy)`,
          originStrategyId: strategyId,
          createdByUserId: actorUserId,
        },
      });
      await this.copyPackageToNewDraft(
        tx,
        tenantId,
        brandId,
        newStrategyId,
        versionId,
        actorUserId,
        1,
      );
      // Clear approval inheritance explicitly already (new DRAFT, no approval record)
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.cloned',
      targetType: 'Strategy',
      targetId: newStrategyId,
      correlationId,
    });
    return this.get(tenantId, brandId, newStrategyId);
  }

  async compare(
    tenantId: string,
    brandId: string,
    strategyId: string,
    leftId: string,
    rightId: string,
  ) {
    const left = await this.getVersion(tenantId, brandId, strategyId, leftId);
    const right = await this.getVersion(tenantId, brandId, strategyId, rightId);
    return {
      data: {
        left: left.data,
        right: right.data,
        diff_summary: {
          status_changed: left.data.status !== right.data.status,
          foundation_changed:
            JSON.stringify(left.data.foundation) !== JSON.stringify(right.data.foundation),
          organic_enablement_changed: left.data.organic_enabled !== right.data.organic_enabled,
          paid_enablement_changed: left.data.paid_enabled !== right.data.paid_enabled,
        },
      },
    };
  }

  async aiPropose(tenantId: string, brandId: string, strategyId: string, versionId: string) {
    const version = await this.requireVersion(tenantId, brandId, strategyId, versionId);
    mustRefuseAiPropose(version.aiAvailability as never);
    const code = aiAvailabilityToErrorCode(version.aiAvailability as never);
    throw new DomainError(
      code,
      aiProposeHonestyMessage(code),
      503,
      `errors.${code.toLowerCase()}`,
      [{ code, manual_journey: true }],
    );
  }

  async getCurrentStrategy(tenantId: string, brandId: string) {
    const brand = await this.requireBrand(tenantId, brandId);
    if (!brand.currentApprovedStrategyId) {
      return { data: { strategy: null, brand_version: brand.version } };
    }
    const strategy = await getPrisma().strategy.findFirst({
      where: tenantWhere(tenantId, { id: brand.currentApprovedStrategyId, brandId }),
    });
    if (!strategy || strategy.status !== 'ACTIVE') {
      return {
        data: {
          strategy: null,
          unavailable: true,
          brand_version: brand.version,
          stale_pointer_id: brand.currentApprovedStrategyId,
        },
      };
    }
    const approved = await getPrisma().strategyVersion.findFirst({
      where: tenantWhere(tenantId, {
        strategyId: strategy.id,
        status: 'APPROVED',
      }),
    });
    if (!approved) {
      return {
        data: {
          strategy: null,
          unavailable: true,
          brand_version: brand.version,
          stale_pointer_id: brand.currentApprovedStrategyId,
        },
      };
    }
    return {
      data: {
        strategy: {
          id: strategy.id,
          name: strategy.name,
          approved_version_id: approved.id,
        },
        brand_version: brand.version,
      },
    };
  }

  async setCurrentStrategy(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: { strategy_id: string | null; brand_version: number },
    correlationId?: string,
  ) {
    const brand = await this.requireBrand(tenantId, brandId);
    if (brand.version !== input.brand_version) {
      throw new DomainError(
        'CONFLICT_VERSION',
        'Stale brand version',
        409,
        'errors.conflict_version',
      );
    }

    if (input.strategy_id === null) {
      await getPrisma().$transaction(async (tx) => {
        const updated = await tx.brandWorkspace.updateMany({
          where: { id: brandId, tenantId, version: input.brand_version },
          data: { currentApprovedStrategyId: null, version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new DomainError(
            'CONFLICT_VERSION',
            'Stale brand version',
            409,
            'errors.conflict_version',
          );
        }
        await this.writeOutbox(tx, tenantId, 'strategy.current_changed', {
          brandId,
          strategyId: null,
        });
      });
      await this.audit.write({
        actorUserId,
        tenantId,
        action: 'strategy.current_cleared',
        targetType: 'BrandWorkspace',
        targetId: brandId,
        correlationId,
      });
      return this.getCurrentStrategy(tenantId, brandId);
    }

    const strategy = await this.requireStrategy(tenantId, brandId, input.strategy_id);
    const approved = await getPrisma().strategyVersion.findFirst({
      where: tenantWhere(tenantId, { strategyId: strategy.id, status: 'APPROVED' }),
    });
    const eligibility = evaluateSetCurrentEligibility({
      strategyTenantId: strategy.tenantId,
      brandTenantId: brand.tenantId,
      strategyBrandId: strategy.brandId,
      brandId,
      strategyStatus: strategy.status as never,
      hasNonSupersededApprovedVersion: Boolean(approved),
      approvedVersionStatus: approved?.status as never,
    });
    if (!eligibility.eligible) {
      throw new DomainError(
        'APPROVAL_INELIGIBLE',
        'Cannot set current',
        422,
        'errors.approval_ineligible',
        eligibility.blockingReasons.map((r) => ({ code: r })),
      );
    }

    await getPrisma().$transaction(async (tx) => {
      const updated = await tx.brandWorkspace.updateMany({
        where: { id: brandId, tenantId, version: input.brand_version },
        data: {
          currentApprovedStrategyId: strategy.id,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new DomainError(
          'CONFLICT_VERSION',
          'Stale brand version',
          409,
          'errors.conflict_version',
        );
      }
      await this.writeOutbox(tx, tenantId, 'strategy.current_changed', {
        brandId,
        strategyId: strategy.id,
      });
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'strategy.current_set',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: strategy.id,
      correlationId,
    });
    return this.getCurrentStrategy(tenantId, brandId);
  }
}
