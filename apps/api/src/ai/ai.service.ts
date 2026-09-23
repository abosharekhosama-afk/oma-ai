import { createHash } from 'node:crypto';
import { getPrisma } from '@oma/db';
import {
  DomainError,
  deterministicProposal,
  evaluateBudget,
  isAiUseCase,
  newId,
  releaseReservation,
  resolveAiPublicState,
  routeModel,
  settleReservation,
  snapshotLedger,
  testAdapterAllowed,
  validateProposal,
  type AiUseCase,
  type LedgerEntry,
} from '@oma/domain';
import { OpenAiProviderAdapter } from '@oma/ai';

function liveEnabled(): boolean {
  return process.env.AI_LIVE_ENABLED === 'true';
}

function modelConfig() {
  return {
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-5.6-luna',
    reasoningModel: process.env.AI_REASONING_MODEL || 'gpt-5.6-terra',
    liveEnabled: false,
  };
}

const TEST_RESERVE_USD = 0.25;

export function aiStatus() {
  const configured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_PROJECT_ID);
  const testAdapter = testAdapterAllowed(process.env);
  return {
    provider: testAdapter ? 'test-adapter' : 'openai',
    live_enabled: false as const,
    billing: 'NOT_ENABLED' as const,
    models: 'CONFIGURED_NOT_LIVE_VERIFIED' as const,
    mode: testAdapter ? ('demo_test' as const) : ('offline' as const),
    label: testAdapter ? 'Demo/Test AI' : 'Billing not enabled',
    default_model: modelConfig().defaultModel,
    reasoning_model: modelConfig().reasoningModel,
    state: testAdapter
      ? 'proposal_ready'
      : resolveAiPublicState({
          providerConfigured: configured,
          liveEnabled: false,
        }),
    manual_journey: true,
    banner: 'AI GENERATED PROPOSAL — REQUIRES HUMAN REVIEW',
  };
}

async function budgetSnapshot(tenantId: string) {
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
  if (!isAiUseCase(input.useCase)) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Unknown AI use case',
      400,
      'errors.validation_failed',
    );
  }
  const useCase = input.useCase as AiUseCase;
  const routed = routeModel(useCase, modelConfig());
  if (liveEnabled()) {
    throw new DomainError(
      'BILLING_NOT_ENABLED',
      'Live OpenAI is not activated. Continue manually.',
      503,
      'errors.billing_not_enabled',
      [{ manual_journey: true }],
    );
  }
  const adapter = new OpenAiProviderAdapter(modelConfig());
  const offline = await adapter.completeStructured({
    useCase,
    payload: { refs: input.evidenceRefs ?? [] },
  });
  if (offline.ok) {
    throw new DomainError(
      'MODEL_NOT_VERIFIED',
      'Live model output is not accepted',
      503,
      'errors.model_not_verified',
    );
  }
  const useTest = testAdapterAllowed(process.env);
  const reserveUsd = useTest ? TEST_RESERVE_USD : 0;
  const snapshot = await budgetSnapshot(input.tenantId);
  const budget = evaluateBudget({
    limits: {
      monthlyUsd: Number(process.env.AI_MONTHLY_BUDGET_USD || 25),
      dailyUsd: Number(process.env.AI_DAILY_BUDGET_USD || 2),
      maxInputTokens: process.env.AI_MAX_INPUT_TOKENS
        ? Number(process.env.AI_MAX_INPUT_TOKENS)
        : null,
      maxOutputTokens: process.env.AI_MAX_OUTPUT_TOKENS
        ? Number(process.env.AI_MAX_OUTPUT_TOKENS)
        : null,
    },
    snapshot,
    reserveUsd,
    inputTokens: (input.evidenceRefs ?? []).join('').length,
    outputTokens: 32,
  });
  if (!budget.ok) {
    throw new DomainError('BUDGET_EXCEEDED', 'AI budget exceeded', 429, 'errors.budget_exceeded', [
      { manual_journey: true, scope: budget.scope },
    ]);
  }
  const proposal = useTest
    ? deterministicProposal({
        useCase,
        evidenceRefs: input.evidenceRefs ?? [],
        sourceVersion: input.sourceVersion,
      })
    : null;
  if (proposal && !validateProposal(proposal).ok) {
    throw new DomainError(
      'SCHEMA_INVALID',
      'Test proposal failed schema validation',
      422,
      'errors.schema_invalid',
    );
  }
  const inputHash = createHash('sha256')
    .update(`${input.tenantId}:${input.useCase}:${input.sourceEntityId}:${input.sourceVersion}`)
    .digest('hex');
  const existing = await getPrisma().aiRun.findUnique({
    where: {
      tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
    },
  });
  if (existing) return { run: existing, created: false, mode: useTest ? 'demo_test' : 'offline' };
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
      provider: useTest ? 'test-adapter' : 'openai',
      model: useTest ? 'test-adapter-v1' : routed.model,
      promptVersion: proposal?.promptVersion ?? '1',
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
      errorCode: proposal ? null : offline.code,
      reservedCost: '0',
      settledCost: String(settled.settledUsd),
      latencyMs: 1,
    },
  });
  if (!proposal) {
    throw new DomainError(
      offline.code === 'AI_DISABLED' ? 'AI_DISABLED' : 'BILLING_NOT_ENABLED',
      'AI text intelligence is offline. Continue manually.',
      503,
      'errors.ai_disabled',
      [{ code: offline.code, manual_journey: true, run_id: run.id }],
    );
  }
  return { run, created: true, mode: 'demo_test' as const, proposal };
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

export async function acceptAiRun(tenantId: string, id: string) {
  const run = await readAiRun(tenantId, id);
  if (!run.proposalJson || run.provider !== 'test-adapter') {
    throw new DomainError(
      'AI_DISABLED',
      'Accept is unavailable while AI is offline.',
      503,
      'errors.ai_disabled',
      [{ manual_journey: true }],
    );
  }
  const proposal = validateProposal(JSON.parse(run.proposalJson));
  if (!proposal.ok) {
    throw new DomainError(
      'SCHEMA_INVALID',
      'Proposal failed validation',
      422,
      'errors.schema_invalid',
    );
  }
  if (run.sourceEntityType === 'approved_profile' || run.sourceEntityType === 'approved_strategy') {
    throw new DomainError(
      'APPROVED_VERSION_IMMUTABLE',
      'Approved versions cannot be modified by AI.',
      409,
      'errors.approved_immutable',
    );
  }
  let draftId: string | null = null;
  if (run.sourceEntityType === 'brand_profile') {
    draftId = newId();
    await getPrisma().profileVersion.create({
      data: {
        id: draftId,
        tenantId,
        brandId: run.sourceEntityId,
        status: 'DRAFT',
        sectionsJson: JSON.stringify({
          ai_proposal: proposal.proposal,
          requires_human_review: true,
        }),
        aiAvailability: 'NOT_CONFIGURED',
      },
    });
  }
  return {
    run_id: run.id,
    draft_id: draftId,
    approved_unchanged: true,
    current_strategy_pointer: 'unchanged',
    human_review: true,
    mode: 'demo_test',
  };
}
