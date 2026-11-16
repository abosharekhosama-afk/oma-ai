import { createHash } from 'node:crypto';
import { getPrisma } from '@oma/db';
import {
  DomainError,
  computeCostUsd,
  defaultAiModels,
  deterministicProposal,
  estimateReserveUsd,
  estimateTokens,
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
  parsePriceTable,
  releaseReservation,
  resolveAiAvailability,
  resolveAiPublicState,
  routeModel,
  settleReservation,
  snapshotLedger,
  strategyAiMode,
  testAdapterAllowed,
  validateProposal,
  type AiUseCase,
  type LedgerEntry,
} from '@oma/domain';
import { createAiAdapterFromEnv, configuredAiProvider, buildBrandAnalysisPrompt } from '@oma/ai';
import { billingService } from '../billing/billing.service';

const TEST_RESERVE_USD = 0.25;

function budgetLimits() {
  return {
    monthlyUsd: Number(process.env.AI_MONTHLY_BUDGET_USD || 25),
    dailyUsd: Number(process.env.AI_DAILY_BUDGET_USD || 2),
    maxInputTokens: process.env.AI_MAX_INPUT_TOKENS
      ? Number(process.env.AI_MAX_INPUT_TOKENS)
      : null,
    maxOutputTokens: process.env.AI_MAX_OUTPUT_TOKENS
      ? Number(process.env.AI_MAX_OUTPUT_TOKENS)
      : null,
  };
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
  const runs = await getPrisma().aiRun.findMany({
    where: { tenantId },
    select: { reservedCost: true, settledCost: true, status: true, createdAt: true },
  });
  const today = new Date().toISOString().slice(0, 10);
  const entries: LedgerEntry[] = runs.map((run) => ({
    tenantId,
    reservedUsd: Number(run.reservedCost || 0),
    settledUsd: Number(run.settledCost || 0),
    countsTowardDay: run.createdAt.toISOString().slice(0, 10) === today,
    status:
      run.status === 'QUEUED' || run.status === 'RUNNING'
        ? 'reserved'
        : run.status === 'SUCCEEDED'
          ? 'settled'
          : 'released',
  }));
  return snapshotLedger(tenantId, entries);
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

function throwForStructuredCode(code: string, message?: string): never {
  if (code === 'AI_DISABLED') {
    throw new DomainError(
      'AI_DISABLED',
      'AI text intelligence is offline. Continue manually.',
      503,
      'errors.ai_disabled',
      [{ code, manual_journey: true }],
    );
  }
  if (code === 'NOT_CONFIGURED') {
    throw new DomainError(
      'AI_NOT_CONFIGURED',
      'AI is not configured. Continue manually.',
      503,
      'errors.ai_not_configured',
      [{ code, manual_journey: true }],
    );
  }
  if (code === 'AUTH' || code === 'QUOTA' || code === 'TIMEOUT' || code === 'RATE_LIMIT') {
    throw new DomainError(
      'AI_UNAVAILABLE',
      message || 'The AI provider is temporarily unavailable.',
      503,
      'errors.ai_unavailable',
      [{ code, manual_journey: true }],
    );
  }
  if (code === 'REFUSAL' || code === 'CONTENT_FILTER') {
    throw new DomainError(
      'AI_REFUSED',
      message || 'The model refused this request.',
      422,
      'errors.ai_refused',
      [{ code, manual_journey: true }],
    );
  }
  if (code === 'SCHEMA_INVALID') {
    throw new DomainError(
      'SCHEMA_INVALID',
      'Model output failed schema validation',
      422,
      'errors.schema_invalid',
    );
  }
  if (code === 'BILLING_NOT_ENABLED') {
    throw new DomainError(
      'BILLING_NOT_ENABLED',
      'Live AI billing is not activated. Continue manually.',
      503,
      'errors.billing_not_enabled',
      [{ manual_journey: true }],
    );
  }
  throw new DomainError(
    'AI_UNAVAILABLE',
    message || 'AI request failed. Continue manually.',
    503,
    'errors.ai_unavailable',
    [{ code, manual_journey: true }],
  );
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
  const priceTable = parsePriceTable(process.env.AI_MODEL_PRICES_JSON);
  const prompt = buildBrandAnalysisPrompt({
    useCase,
    sourceVersion: input.sourceVersion,
    observations: [],
    evidence,
    maxInputTokens: budgetLimits().maxInputTokens ?? 6000,
  });

  const existing = await getPrisma().aiRun.findUnique({
    where: {
      tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
    },
  });
  if (existing)
    return {
      run: existing,
      created: false,
      mode: useTest ? 'demo_test' : live ? 'live' : 'offline',
    };

  let proposal = useTest
    ? deterministicProposal({
        useCase,
        evidenceRefs,
        sourceVersion: input.sourceVersion,
      })
    : null;

  let inputTokens = estimateTokens(prompt.user);
  let outputTokens = 32;
  let model = useTest ? 'test-adapter-v1' : routed.model;
  const provider = useTest ? 'test-adapter' : configuredAiProvider();
  let structuredCode: string | null = live ? null : 'AI_DISABLED';

  if (live && !useTest) {
    const reservedEstimate = estimateReserveUsd({
      model: routed.model,
      estimatedInputTokens: prompt.estimatedTokens,
      maxOutputTokens: budgetLimits().maxOutputTokens ?? 1500,
      table: priceTable,
    });
    const snapshot = await budgetSnapshot(input.tenantId);
    const budget = evaluateBudget({
      limits: budgetLimits(),
      snapshot,
      reserveUsd: reservedEstimate,
      inputTokens: prompt.estimatedTokens,
      outputTokens: budgetLimits().maxOutputTokens ?? 1500,
    });
    if (!budget.ok) {
      throw new DomainError(
        'BUDGET_EXCEEDED',
        'AI budget exceeded',
        429,
        'errors.budget_exceeded',
        [{ manual_journey: true, scope: budget.scope }],
      );
    }
    const adapter = createAiAdapterFromEnv();
    const result = await adapter.completeStructured({
      useCase,
      payload: { refs: evidenceRefs },
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
    });
    if (!result.ok) throwForStructuredCode(result.code, result.message);
    proposal = result.proposal;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    model = result.model;
    structuredCode = null;
  } else if (!useTest) {
    const adapter = createAiAdapterFromEnv();
    const offline = await adapter.completeStructured({
      useCase,
      payload: { refs: evidenceRefs },
    });
    structuredCode = offline.ok ? null : offline.code;
  }

  if (proposal && !validateProposal(proposal).ok) {
    throw new DomainError(
      'SCHEMA_INVALID',
      'Proposal failed schema validation',
      422,
      'errors.schema_invalid',
    );
  }

  const reserveUsd = proposal
    ? useTest
      ? TEST_RESERVE_USD
      : computeCostUsd(model, inputTokens, outputTokens, priceTable)
    : 0;
  const snapshot = await budgetSnapshot(input.tenantId);
  const budget = evaluateBudget({
    limits: budgetLimits(),
    snapshot,
    reserveUsd: useTest || live ? reserveUsd || TEST_RESERVE_USD : 0,
    inputTokens,
    outputTokens,
  });
  if (!budget.ok) {
    throw new DomainError('BUDGET_EXCEEDED', 'AI budget exceeded', 429, 'errors.budget_exceeded', [
      { manual_journey: true, scope: budget.scope },
    ]);
  }

  if (proposal) {
    await billingService.consumeUsage(input.tenantId, 'ai_credits_per_month', 1);
  }

  const inputHash = createHash('sha256')
    .update(`${input.tenantId}:${input.useCase}:${input.sourceEntityId}:${input.sourceVersion}`)
    .digest('hex');
  const reserved = {
    tenantId: input.tenantId,
    reservedUsd: reserveUsd,
    settledUsd: 0,
    status: 'reserved' as const,
  };
  const settled = proposal ? settleReservation(reserved) : releaseReservation(reserved);
  const run = await getPrisma().aiRun.create({
    data: {
      id: newId(),
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      useCase,
      provider,
      model,
      promptVersion: proposal?.promptVersion ?? prompt.promptVersion,
      schemaVersion: '1',
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      sourceVersion: input.sourceVersion,
      status: proposal ? 'SUCCEEDED' : 'DISABLED',
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      inputHash,
      outputHash: proposal
        ? createHash('sha256').update(JSON.stringify(proposal)).digest('hex')
        : null,
      proposalJson: proposal ? JSON.stringify(proposal) : null,
      errorCode: proposal ? null : structuredCode,
      inputTokens,
      outputTokens,
      estimatedCost: String(reserveUsd),
      reservedCost: '0',
      settledCost: String(settled.settledUsd),
      latencyMs: 1,
    },
  });
  if (!proposal) {
    throw new DomainError(
      structuredCode === 'AI_DISABLED' ? 'AI_DISABLED' : 'BILLING_NOT_ENABLED',
      'AI text intelligence is offline. Continue manually.',
      503,
      'errors.ai_disabled',
      [{ code: structuredCode, manual_journey: true, run_id: run.id }],
    );
  }
  return {
    run,
    created: true,
    mode: useTest ? ('demo_test' as const) : ('live' as const),
    proposal,
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

  const proposal = validateProposal(JSON.parse(run.proposalJson));
  if (!proposal.ok) {
    throw new DomainError(
      'SCHEMA_INVALID',
      'Proposal failed validation',
      422,
      'errors.schema_invalid',
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
          by: actorUserId ?? 'unknown',
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
    await tx.profileVersion.create({
      data: {
        id: draftId,
        tenantId,
        brandId: run.sourceEntityId,
        status: 'DRAFT',
        sectionsJson: JSON.stringify({
          ai_proposal: proposal.proposal,
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
  const updated = await getPrisma().aiRun.updateMany({
    where: { id: run.id, tenantId, version: run.version },
    data: {
      refusalReason: 'HUMAN_REJECTED',
      metadataJson: writeAiRunReview(run.metadataJson, {
        decision: 'rejected',
        by: actorUserId ?? 'unknown',
        at: new Date().toISOString(),
        reason: trimmed,
      }),
      version: { increment: 1 },
    },
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
