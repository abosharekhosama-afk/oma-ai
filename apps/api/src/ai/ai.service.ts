import { getPrisma, tenantAiLedgerSnapshot } from '@oma/db';
import {
  DomainError,
  aiBudgetLimitsFromEnv,
  defaultAiModels,
  brandAnalysisContractFor,
  deterministicBrandAnalysisV2,
  storedProposalVersion,
  AI_RUNS_PAGE_MAX,
  aiUsageMonthRange,
  decodeAiRunCursor,
  encodeAiRunCursor,
  summarizeAiUsage,
  assertAiWriteTarget,
  assertHumanActor,
  evaluateBudget,
  isAiLiveEnabled,
  isAiProviderConfigured,
  isAiUseCase,
  isGenericAiRunSourceType,
  isGenericAiRunUseCase,
  newId,
  normalizeEvidenceRefs,
  readAiRunReview,
  writeAiRunReview,
  GENERIC_AI_RUN_SOURCE_TYPES,
  GENERIC_AI_RUN_USE_CASES,
  resolveAiAvailability,
  resolveAiPublicState,
  routeModel,
  strategyAiMode,
  testAdapterAllowed,
  type AiUseCase,
} from '@oma/domain';
import { configuredAiProvider, buildBrandAnalysisPrompt } from '@oma/ai';
import { billingService } from '../billing/billing.service';
import { runStructuredGeneration, structuredInputHash } from './structured-run';

function budgetLimits() {
  return aiBudgetLimitsFromEnv();
}

export function aiStatus() {
  const configured = isAiProviderConfigured();
  const live = isAiLiveEnabled();
  const testAdapter = testAdapterAllowed(process.env);
  const models = defaultAiModels();
  return {
    provider: testAdapter ? 'test-adapter' : configuredAiProvider(),
    live_enabled: live,
    billing: live ? ('ENABLED' as const) : ('NOT_ENABLED' as const),
    models: live ? ('LIVE_READY' as const) : ('CONFIGURED_NOT_LIVE_VERIFIED' as const),
    mode: testAdapter ? ('demo_test' as const) : live ? ('live' as const) : ('offline' as const),
    label: testAdapter
      ? 'Demo/Test AI'
      : live
        ? 'Live AI (human review required)'
        : configured
          ? 'Configured but not live'
          : 'AI not configured',
    default_model: models.defaultModel,
    reasoning_model: models.reasoningModel,
    availability: resolveAiAvailability({
      liveEnabled: live,
      providerConfigured: configured,
      testAdapter,
    }),
    state: testAdapter
      ? 'proposal_ready'
      : resolveAiPublicState({
          providerConfigured: configured,
          liveEnabled: live,
        }),
    manual_journey: !live && !testAdapter,
    banner: 'AI GENERATED PROPOSAL — REQUIRES HUMAN REVIEW',
    strategy_ai_mode: strategyAiMode(),
  };
}

export async function budgetSnapshot(tenantId: string) {
  return tenantAiLedgerSnapshot(tenantId);
}

export async function aiBudgetForTenant(tenantId: string) {
  const snapshot = await budgetSnapshot(tenantId);
  const limits = budgetLimits();
  const decision = evaluateBudget({
    limits,
    snapshot,
    reserveUsd: 0.01,
    inputTokens: 1,
    outputTokens: 1,
  });
  const exhausted = !decision.ok;
  return {
    monthly_usd: limits.monthlyUsd,
    daily_usd: limits.dailyUsd,
    warning_ratio: 0.8,
    live_enabled: isAiLiveEnabled(),
    spent: snapshot,
    availability: resolveAiAvailability({
      liveEnabled: isAiLiveEnabled(),
      providerConfigured: isAiProviderConfigured(),
      testAdapter: testAdapterAllowed(process.env),
      budgetExhausted: exhausted,
    }),
    warning: decision.ok ? decision.warning : false,
  };
}

function readMetadataEvidenceRefs(metadataJson: string | null): string[] {
  try {
    const refs = (JSON.parse(metadataJson ?? '{}') as { evidenceRefs?: unknown }).evidenceRefs;
    return Array.isArray(refs) ? refs.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

async function requireTenantBrand(tenantId: string, brandId: string) {
  const brand =
    typeof brandId === 'string' && brandId
      ? await getPrisma().brandWorkspace.findFirst({
          where: { id: brandId, tenantId, deletedAt: null },
          select: { id: true },
        })
      : null;
  if (!brand) throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
  return brand;
}

async function requireTenantEvidence(tenantId: string, brandId: string, refs: string[]) {
  if (!refs.length) return [];
  const rows = await getPrisma().evidenceExcerpt.findMany({
    where: { id: { in: refs }, tenantId, brandId },
    select: { id: true, canonicalUrl: true, sourceUrl: true, pageTitle: true, excerptText: true },
  });
  if (rows.length !== refs.length) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'evidence_refs must reference evidence of this brand',
      400,
      'errors.validation_failed',
      [{ field: 'evidence_refs' }],
    );
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return refs.map((id) => {
    const row = byId.get(id)!;
    return {
      id,
      url: row.canonicalUrl || row.sourceUrl,
      title: row.pageTitle ?? undefined,
      excerpt: row.excerptText,
    };
  });
}

export async function createAiRun(input: {
  tenantId: string;
  actorUserId: string;
  useCase: string;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceVersion: string;
  idempotencyKey: string;
  correlationId?: string;
  evidenceRefs?: string[];
}) {
  if (!isAiUseCase(input.useCase) || !isGenericAiRunUseCase(input.useCase)) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'This AI use case is not available on the generic runs endpoint',
      400,
      'errors.validation_failed',
      [{ field: 'use_case', allowed: [...GENERIC_AI_RUN_USE_CASES] }],
    );
  }
  if (!isGenericAiRunSourceType(input.sourceEntityType)) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Unsupported AI source entity type',
      400,
      'errors.validation_failed',
      [{ field: 'source_entity_type', allowed: [...GENERIC_AI_RUN_SOURCE_TYPES] }],
    );
  }
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs);
  if (evidenceRefs === null) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'evidence_refs must be a bounded array of evidence ids',
      400,
      'errors.validation_failed',
      [{ field: 'evidence_refs' }],
    );
  }
  if (typeof input.idempotencyKey !== 'string' || !input.idempotencyKey.trim()) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'idempotency_key is required',
      400,
      'errors.validation_failed',
      [{ field: 'idempotency_key' }],
    );
  }
  const useCase = input.useCase as AiUseCase;
  // Ownership: the source brand must belong to the caller's tenant.
  await requireTenantBrand(input.tenantId, input.sourceEntityId);
  const evidence = await requireTenantEvidence(input.tenantId, input.sourceEntityId, evidenceRefs);
  await billingService.assertFeature(input.tenantId, 'ai_assist');
  const routed = routeModel(useCase, defaultAiModels());
  const useTest = testAdapterAllowed(process.env);
  const live = isAiLiveEnabled();
  const prompt = buildBrandAnalysisPrompt({
    useCase,
    sourceVersion: input.sourceVersion,
    observations: [],
    evidence,
    maxInputTokens: budgetLimits().maxInputTokens ?? 6000,
  });

  const analysisContract = brandAnalysisContractFor(evidenceRefs);
  const existing = await getPrisma().aiRun.findUnique({
    where: {
      tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
    },
  });
  if (existing && existing.status !== 'SUCCEEDED')
    return {
      run: existing,
      created: false,
      mode: useTest ? 'demo_test' : live ? 'live' : 'offline',
    };

  if (!useTest && !live) {
    // Offline: record the honest DISABLED state; no provider call, no cost.
    const run = await getPrisma().aiRun.create({
      data: {
        id: newId(),
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        useCase,
        provider: configuredAiProvider(),
        model: routed.model,
        promptVersion: prompt.promptVersion,
        promptId: prompt.promptId,
        schemaVersion: analysisContract.schemaVersion,
        contractId: analysisContract.contractId,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        sourceVersion: input.sourceVersion,
        status: 'DISABLED',
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        inputHash: structuredInputHash(prompt, analysisContract.jsonSchema()),
        errorCode: 'AI_DISABLED',
        failureStage: 'provider',
        attemptCount: 0,
        latencyMs: 0,
      },
    });
    throw new DomainError(
      'AI_DISABLED',
      'AI text intelligence is offline. Continue manually.',
      503,
      'errors.ai_disabled',
      [{ code: 'AI_DISABLED', manual_journey: true, run_id: run.id }],
    );
  }

  const result = await runStructuredGeneration({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    useCase,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    sourceVersion: input.sourceVersion,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    prompt,
    schema: analysisContract.jsonSchema(),
    contractId: analysisContract.contractId,
    schemaVersion: analysisContract.schemaVersion,
    parse: analysisContract.parse,
    testValue: () =>
      deterministicBrandAnalysisV2({
        promptId: prompt.promptId,
        promptVersion: prompt.promptVersion,
        evidenceRefs,
        sourceVersion: input.sourceVersion,
        language: prompt.language,
      }),
    serialize: (value) => value,
    metadata: { kind: 'generic_run', evidenceRefs },
  });
  const run = await readAiRun(input.tenantId, result.runId);
  return {
    run,
    created: !result.replayed,
    mode: useTest ? ('demo_test' as const) : ('live' as const),
    proposal: result.value,
  };
}

export async function readAiRun(tenantId: string, id: string) {
  const run = await getPrisma().aiRun.findFirst({ where: { id, tenantId } });
  if (!run) throw new DomainError('NOT_FOUND', 'AI run not found', 404, 'errors.not_found');
  return run;
}

export async function cancelAiRun(tenantId: string, id: string) {
  const run = await readAiRun(tenantId, id);
  if (run.status === 'SUCCEEDED') {
    throw new DomainError(
      'APPROVED_VERSION_IMMUTABLE',
      'Completed proposals are not cancelled in place',
      409,
      'errors.conflict_state',
    );
  }
  return getPrisma().aiRun.update({
    where: { id: run.id },
    data: { status: 'CANCELLED', reservedCost: '0', settledCost: '0', version: { increment: 1 } },
  });
}

function requireGenericReviewableRun(run: {
  useCase: string;
  sourceEntityType: string;
  status: string;
  proposalJson: string | null;
}) {
  if (!isGenericAiRunUseCase(run.useCase) || !isGenericAiRunSourceType(run.sourceEntityType)) {
    throw new DomainError(
      'CONFLICT_STATE',
      'This AI run is reviewed through its own workflow.',
      409,
      'errors.conflict_state',
      [{ use_case: run.useCase, source_entity_type: run.sourceEntityType }],
    );
  }
}

export async function acceptAiRun(tenantId: string, id: string, actorUserId?: string) {
  assertHumanActor(actorUserId);
  const run = await readAiRun(tenantId, id);
  if (run.sourceEntityType === 'approved_profile' || run.sourceEntityType === 'approved_strategy') {
    throw new DomainError(
      'APPROVED_VERSION_IMMUTABLE',
      'Approved versions cannot be modified by AI.',
      409,
      'errors.approved_immutable',
    );
  }
  requireGenericReviewableRun(run);
  if (!run.proposalJson || run.status !== 'SUCCEEDED') {
    throw new DomainError(
      'AI_DISABLED',
      'Accept is unavailable while AI is offline.',
      503,
      'errors.ai_disabled',
      [{ manual_journey: true }],
    );
  }
  const review = readAiRunReview(run.metadataJson);
  if (review?.decision === 'rejected') {
    throw new DomainError(
      'CONFLICT_STATE',
      'This AI proposal was already rejected.',
      409,
      'errors.conflict_state',
      [{ review: 'rejected' }],
    );
  }
  const mode = run.provider === 'test-adapter' ? 'demo_test' : 'live';
  const result = (draftId: string | null, replayed: boolean) => ({
    run_id: run.id,
    draft_id: draftId,
    approved_unchanged: true,
    current_strategy_pointer: 'unchanged',
    human_review: true,
    replayed,
    mode,
  });
  if (review?.decision === 'accepted') return result(review.draftId, true);

  if (storedProposalVersion(run.proposalJson) !== '2') {
    // DEC-027 #9: v1 proposals are display-only; regenerate to accept.
    throw new DomainError(
      'CONFLICT_STATE',
      'This AI proposal uses a legacy format. Generate a new proposal to accept it.',
      409,
      'errors.conflict_state',
      [{ code: 'LEGACY_PROPOSAL', regenerate: true }],
    );
  }
  const proposal = brandAnalysisContractFor(readMetadataEvidenceRefs(run.metadataJson)).parse(
    JSON.parse(run.proposalJson),
  );
  if (!proposal.ok) {
    throw new DomainError(
      'SCHEMA_INVALID',
      'Proposal failed validation',
      422,
      'errors.schema_invalid',
      [{ issues: proposal.issues.slice(0, 10) }],
    );
  }
  // Ownership: re-check the brand belongs to this tenant before writing anything.
  await requireTenantBrand(tenantId, run.sourceEntityId);
  const draftId = newId();
  const at = new Date().toISOString();
  await getPrisma().$transaction(async (tx) => {
    const claimed = await tx.aiRun.updateMany({
      where: { id: run.id, tenantId, version: run.version },
      data: {
        metadataJson: writeAiRunReview(run.metadataJson, {
          decision: 'accepted',
          by: actorUserId,
          at,
          draftId,
        }),
        version: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      throw new DomainError(
        'CONFLICT_STATE',
        'This AI proposal changed while it was being accepted.',
        409,
        'errors.conflict_state',
      );
    }
    assertAiWriteTarget({ kind: 'profile_version', status: 'DRAFT' });
    await tx.auditEvent.create({
      data: {
        id: newId(),
        actorUserId,
        actorType: 'USER',
        tenantId,
        action: 'ai.run.accepted',
        targetType: 'profile_version',
        targetId: draftId,
        afterRef: `ai_run:${run.id}`,
      },
    });
    await tx.profileVersion.create({
      data: {
        id: draftId,
        tenantId,
        brandId: run.sourceEntityId,
        status: 'DRAFT',
        sectionsJson: JSON.stringify({
          ai_proposal: proposal.value,
          ai_run_id: run.id,
          requires_human_review: true,
        }),
        aiAvailability:
          run.provider === configuredAiProvider() && isAiLiveEnabled() ? 'USED' : 'NOT_CONFIGURED',
      },
    });
  });
  return result(draftId, false);
}

export async function rejectAiRun(
  tenantId: string,
  id: string,
  actorUserId?: string,
  reason?: string | null,
) {
  assertHumanActor(actorUserId);
  const run = await readAiRun(tenantId, id);
  requireGenericReviewableRun(run);
  const review = readAiRunReview(run.metadataJson);
  if (review?.decision === 'accepted') {
    throw new DomainError(
      'CONFLICT_STATE',
      'This AI proposal was already accepted.',
      409,
      'errors.conflict_state',
      [{ review: 'accepted', draft_id: review.draftId }],
    );
  }
  const trimmed = typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null;
  if (review?.decision === 'rejected') {
    return { id: run.id, status: 'REFUSED' as const, manual_journey: true, replayed: true };
  }
  // Keep the run status (and its settled cost) intact so budget accounting is unchanged;
  // the human decision is recorded on the run itself.
  const updated = await getPrisma().$transaction(async (tx) => {
    const res = await tx.aiRun.updateMany({
      where: { id: run.id, tenantId, version: run.version },
      data: {
        refusalReason: 'HUMAN_REJECTED',
        metadataJson: writeAiRunReview(run.metadataJson, {
          decision: 'rejected',
          by: actorUserId,
          at: new Date().toISOString(),
          reason: trimmed,
        }),
        version: { increment: 1 },
      },
    });
    if (res.count === 1) {
      await tx.auditEvent.create({
        data: {
          id: newId(),
          actorUserId,
          actorType: 'USER',
          tenantId,
          action: 'ai.run.rejected',
          targetType: 'ai_run',
          targetId: run.id,
          afterRef: trimmed ? `reason:${trimmed}`.slice(0, 500) : undefined,
        },
      });
    }
    return res;
  });
  if (updated.count !== 1) {
    throw new DomainError(
      'CONFLICT_STATE',
      'This AI proposal changed while it was being rejected.',
      409,
      'errors.conflict_state',
    );
  }
  return { id: run.id, status: 'REFUSED' as const, manual_journey: true, replayed: false };
}

function runListItem(run: {
  id: string;
  useCase: string;
  status: string;
  provider: string;
  model: string;
  contractId: string | null;
  schemaVersion: string;
  attemptCount: number;
  failureStage: string | null;
  errorCode: string | null;
  refusalReason: string | null;
  settledCost: unknown;
  latencyMs: number | null;
  sourceEntityType: string;
  sourceEntityId: string;
  metadataJson: string | null;
  createdAt: Date;
}) {
  const review = readAiRunReview(run.metadataJson);
  return {
    id: run.id,
    use_case: run.useCase,
    status: run.status,
    provider: run.provider,
    model: run.model,
    contract_id: run.contractId,
    schema_version: run.schemaVersion,
    legacy: run.schemaVersion === '1',
    attempt_count: run.attemptCount,
    failure_stage: run.failureStage,
    error_code: run.errorCode,
    refusal_reason: run.refusalReason,
    review: review?.decision ?? null,
    cost_usd: Number(run.settledCost ?? 0),
    latency_ms: run.latencyMs,
    source_entity_type: run.sourceEntityType,
    source_entity_id: run.sourceEntityId,
    created_at: run.createdAt.toISOString(),
  };
}

/** Admin list of this tenant's AI runs, newest first, keyset-paginated (DEC-027 3.8). */
export async function listAiRuns(
  tenantId: string,
  query: { cursor?: string; limit?: string | number; use_case?: string; status?: string },
) {
  const limit = Math.min(AI_RUNS_PAGE_MAX, Math.max(1, Number(query.limit) || 25));
  const cursor = decodeAiRunCursor(query.cursor);
  if (query.cursor && !cursor) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid cursor', 400, 'errors.validation_failed', [
      { field: 'cursor' },
    ]);
  }
  const STATUSES = [
    'QUEUED',
    'RUNNING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'DISABLED',
    'SCHEMA_INVALID',
    'REFUSED',
  ];
  if (query.status && !STATUSES.includes(query.status)) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid status', 400, 'errors.validation_failed', [
      { field: 'status' },
    ]);
  }
  const rows = await getPrisma().aiRun.findMany({
    where: {
      tenantId,
      ...(query.use_case ? { useCase: query.use_case } : {}),
      ...(query.status ? { status: query.status as never } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(runListItem),
    next_cursor: rows.length > limit && last ? encodeAiRunCursor(last.createdAt, last.id) : null,
  };
}

/** Admin usage summary for one UTC month: runs, failures, repairs and real cost. */
export async function aiUsageForTenant(tenantId: string, month?: string) {
  const range = aiUsageMonthRange(month);
  const rows = await getPrisma().aiRun.findMany({
    where: { tenantId, createdAt: { gte: range.start, lt: range.end } },
    select: {
      useCase: true,
      status: true,
      attemptCount: true,
      settledCost: true,
      refusalReason: true,
      schemaVersion: true,
    },
  });
  return {
    month: range.month,
    ...summarizeAiUsage(
      rows.map((r) => ({
        ...r,
        settledCost: r.settledCost === null ? null : String(r.settledCost),
      })),
    ),
    budget: await budgetSnapshot(tenantId),
  };
}
