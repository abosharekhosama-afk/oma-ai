import { createHash } from 'node:crypto';
import { getPrisma } from '@oma/db';
import {
  DomainError,
  computeCostUsd,
  defaultAiModels,
  estimateReserveUsd,
  estimateTokens,
  evaluateBudget,
  isAiAnalysisAvailable,
  isAiLiveEnabled,
  newId,
  routeModel,
  parsePriceTable,
  settleReservation,
  snapshotLedger,
  testAdapterAllowed,
  type AiUseCase,
  type LedgerEntry,
} from '@oma/domain';
import { createAiAdapterFromEnv, configuredAiProvider, type PromptSpec } from '@oma/ai';
import { billingService } from '../billing/billing.service';
import { throwForStructuredCode } from './ai-errors';
import { budgetSnapshot as sharedBudgetSnapshot } from './ai.service';

const TEST_RESERVE_USD = 0.05;

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

export async function budgetSnapshot(tenantId: string) {
  return sharedBudgetSnapshot(tenantId);
}

async function ledgerSnapshot(tenantId: string) {
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

export async function runStructuredGeneration<T>(input: {
  tenantId: string;
  actorUserId: string;
  useCase: AiUseCase;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceVersion: string;
  idempotencyKey: string;
  correlationId?: string;
  prompt: PromptSpec & { estimatedTokens: number };
  schema: Record<string, unknown>;
  parse: (raw: unknown) => { ok: true; value: T } | { ok: false; code?: string };
  testValue: () => T;
  serialize: (value: T) => unknown;
  brandProfileVersionId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{
  value: T;
  runId: string;
  replayed: boolean;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}> {
  await billingService.assertFeature(input.tenantId, 'ai_assist');
  const existing = await getPrisma().aiRun.findUnique({
    where: {
      tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
    },
  });
  if (existing?.status === 'SUCCEEDED' && existing.proposalJson) {
    const parsed = input.parse(JSON.parse(existing.proposalJson));
    if (parsed.ok) {
      return {
        value: parsed.value,
        runId: existing.id,
        replayed: true,
        model: existing.model,
        provider: existing.provider,
        inputTokens: existing.inputTokens,
        outputTokens: existing.outputTokens,
        costUsd: Number(existing.settledCost || 0),
      };
    }
  }

  const useTest = testAdapterAllowed(process.env);
  const live = isAiLiveEnabled();
  if (!useTest && !live) {
    throw new DomainError(
      'AI_NOT_CONFIGURED',
      'AI is not configured. Continue manually.',
      503,
      'errors.ai_not_configured',
      [{ code: 'NOT_CONFIGURED', manual_journey: true, fallback: 'template' }],
    );
  }

  const priceTable = parsePriceTable(process.env.AI_MODEL_PRICES_JSON);
  const routed = routeModel(input.useCase, defaultAiModels());
  const reservedEstimate = useTest
    ? TEST_RESERVE_USD
    : estimateReserveUsd({
        model: routed.model,
        estimatedInputTokens: input.prompt.estimatedTokens,
        maxOutputTokens: budgetLimits().maxOutputTokens ?? 800,
        table: priceTable,
      });
  const snapshot = await ledgerSnapshot(input.tenantId);
  const budget = evaluateBudget({
    limits: budgetLimits(),
    snapshot,
    reserveUsd: reservedEstimate,
    inputTokens: input.prompt.estimatedTokens,
    outputTokens: budgetLimits().maxOutputTokens ?? 800,
  });
  if (!budget.ok) {
    throw new DomainError('BUDGET_EXCEEDED', 'AI budget exceeded', 429, 'errors.budget_exceeded', [
      { manual_journey: true, scope: budget.scope },
    ]);
  }

  let raw: unknown;
  let model = useTest ? 'test-adapter-v1' : routed.model;
  const provider = useTest ? 'test-adapter' : configuredAiProvider();
  let inputTokens = estimateTokens(input.prompt.user);
  let outputTokens = 64;

  if (useTest) {
    raw = input.testValue();
  } else {
    const adapter = createAiAdapterFromEnv();
    const result = await adapter.completeStructured({
      useCase: input.useCase,
      payload: { source: input.sourceEntityId },
      systemPrompt: input.prompt.system,
      userPrompt: input.prompt.user,
      schema: input.schema,
      validate: (parsed) => {
        const checked = input.parse(parsed);
        return checked.ok ? { ok: true as const, value: checked.value } : { ok: false as const };
      },
    });
    if (!result.ok) throwForStructuredCode(result.code, result.message);
    raw = result.output;
    model = result.model;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
  }

  const parsed = input.parse(raw);
  if (!parsed.ok) {
    throw new DomainError(
      'SCHEMA_INVALID',
      'Model output failed schema validation',
      422,
      'errors.schema_invalid',
    );
  }

  const costUsd = useTest
    ? TEST_RESERVE_USD
    : computeCostUsd(model, inputTokens, outputTokens, priceTable);
  const reserved = {
    tenantId: input.tenantId,
    reservedUsd: costUsd,
    settledUsd: 0,
    status: 'reserved' as const,
  };
  const settled = settleReservation(reserved);
  await billingService.consumeUsage(input.tenantId, 'ai_credits_per_month', 1);

  const serialized = input.serialize(parsed.value);
  const metadata = {
    promptId: input.prompt.promptId,
    promptVersion: input.prompt.promptVersion,
    brandProfileVersionId: input.brandProfileVersionId ?? null,
    ...input.metadata,
  };
  const runId = existing?.id ?? newId();
  const data = {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    useCase: input.useCase,
    provider,
    model,
    promptVersion: input.prompt.promptVersion,
    promptId: input.prompt.promptId,
    schemaVersion: '1',
    metadataJson: JSON.stringify(metadata),
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    sourceVersion: input.sourceVersion,
    status: 'SUCCEEDED' as const,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    inputHash: createHash('sha256')
      .update(`${input.tenantId}:${input.useCase}:${input.sourceEntityId}:${input.sourceVersion}`)
      .digest('hex'),
    outputHash: createHash('sha256').update(JSON.stringify(serialized)).digest('hex'),
    proposalJson: JSON.stringify(serialized),
    errorCode: null,
    inputTokens,
    outputTokens,
    estimatedCost: String(costUsd),
    reservedCost: '0',
    settledCost: String(settled.settledUsd),
    latencyMs: 1,
  };

  if (existing) {
    await getPrisma().aiRun.update({ where: { id: existing.id }, data });
  } else {
    await getPrisma().aiRun.create({ data: { id: runId, ...data } });
  }

  return {
    value: parsed.value,
    runId,
    replayed: false,
    model,
    provider,
    inputTokens,
    outputTokens,
    costUsd,
  };
}

export function requireAiAvailableOrThrow() {
  if (!isAiAnalysisAvailable()) {
    throw new DomainError(
      'AI_NOT_CONFIGURED',
      'AI is not configured. Continue manually.',
      503,
      'errors.ai_not_configured',
      [{ code: 'NOT_CONFIGURED', manual_journey: true, fallback: 'template' }],
    );
  }
}
