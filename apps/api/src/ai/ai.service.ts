import { createHash } from 'node:crypto';
import { getPrisma } from '@oma/db';
import {
  DomainError,
  evaluateBudget,
  isAiUseCase,
  newId,
  resolveAiPublicState,
  routeModel,
  type AiUseCase,
} from '@oma/domain';
import { OpenAiProviderAdapter } from '@oma/ai';

function liveEnabled(): boolean {
  return process.env.AI_LIVE_ENABLED === 'true';
}

function modelConfig() {
  return {
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-5.6-luna',
    reasoningModel: process.env.AI_REASONING_MODEL || 'gpt-5.6-terra',
    liveEnabled: liveEnabled(),
  };
}

export function aiStatus() {
  const configured = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_PROJECT_ID);
  return {
    provider: 'openai',
    live_enabled: false as const,
    billing: 'NOT_ENABLED' as const,
    models: 'CONFIGURED_NOT_LIVE_VERIFIED' as const,
    default_model: modelConfig().defaultModel,
    reasoning_model: modelConfig().reasoningModel,
    state: resolveAiPublicState({
      providerConfigured: configured,
      liveEnabled: false,
    }),
    manual_journey: true,
    banner: 'AI GENERATED PROPOSAL — REQUIRES HUMAN REVIEW',
  };
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
  const adapter = new OpenAiProviderAdapter(modelConfig());
  const decision = await adapter.completeStructured({
    useCase,
    payload: { refs: input.evidenceRefs ?? [] },
  });
  const budget = evaluateBudget({
    limits: {
      monthlyUsd: Number(process.env.AI_MONTHLY_BUDGET_USD || 25),
      dailyUsd: Number(process.env.AI_DAILY_BUDGET_USD || 2),
      maxInputTokens: null,
      maxOutputTokens: null,
    },
    snapshot: { monthlySpentUsd: 0, dailySpentUsd: 0, monthlyReservedUsd: 0, dailyReservedUsd: 0 },
    reserveUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
  });
  if (!budget.ok) {
    throw new DomainError('BUDGET_EXCEEDED', 'AI budget exceeded', 429, 'errors.budget_exceeded', [
      { manual_journey: true },
    ]);
  }
  const inputHash = createHash('sha256')
    .update(`${input.tenantId}:${input.useCase}:${input.sourceEntityId}:${input.sourceVersion}`)
    .digest('hex');
  const existing = await getPrisma().aiRun.findUnique({
    where: {
      tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
    },
  });
  if (existing) return { run: existing, created: false };
  const run = await getPrisma().aiRun.create({
    data: {
      id: newId(),
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      useCase,
      provider: 'openai',
      model: routed.model,
      promptVersion: '1',
      schemaVersion: '1',
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      sourceVersion: input.sourceVersion,
      status: 'DISABLED',
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      inputHash,
      errorCode: decision.ok ? 'MODEL_NOT_VERIFIED' : decision.code,
      reservedCost: '0',
      settledCost: '0',
    },
  });
  if (!decision.ok) {
    throw new DomainError(
      decision.code === 'AI_DISABLED' ? 'AI_DISABLED' : 'BILLING_NOT_ENABLED',
      'AI text intelligence is offline. Continue manually.',
      503,
      'errors.ai_disabled',
      [{ code: decision.code, manual_journey: true, run_id: run.id }],
    );
  }
  return { run, created: true };
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
    data: { status: 'CANCELLED', version: { increment: 1 } },
  });
}
