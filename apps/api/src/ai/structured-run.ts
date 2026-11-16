import { createHash } from 'node:crypto';
import {
  failAiRun,
  getPrisma,
  reserveAiRun,
  settleAiRun,
  tenantAiLedgerSnapshot,
  type AiRunFailureStage,
} from '@oma/db';
import {
  AI_RESERVATION_STALE_MS,
  DomainError,
  aiBudgetLimitsFromEnv,
  computeCostUsd,
  defaultAiModels,
  estimateReserveUsd,
  estimateTokens,
  isAiAnalysisAvailable,
  isAiLiveEnabled,
  newId,
  routeModel,
  parsePriceTable,
  testAdapterAllowed,
  type AiUseCase,
} from '@oma/domain';
import { createAiAdapterFromEnv, configuredAiProvider, type PromptSpec } from '@oma/ai';
import { billingService } from '../billing/billing.service';
import { throwForStructuredCode } from './ai-errors';

const TEST_RESERVE_USD = 0.05;
const DEFAULT_MAX_OUTPUT_TOKENS = 800;
/** Window in which an identical request without an explicit key replays the same run. */
export const AUTO_IDEMPOTENCY_WINDOW_MS = 60_000;

export async function budgetSnapshot(tenantId: string) {
  return tenantAiLedgerSnapshot(tenantId);
}

export type StructuredParse<T> =
  { ok: true; value: T } | { ok: false; code?: string; issues?: string[] };

export function structuredInputHash(prompt: { system: string; user: string }, schema: unknown) {
  return createHash('sha256')
    .update(prompt.system)
    .update('\n---\n')
    .update(prompt.user)
    .update('\n---\n')
    .update(JSON.stringify(schema))
    .digest('hex');
}

/**
 * Deterministic key for callers that did not send an Idempotency-Key: the same
 * actor sending the same prompt within the window gets the same run (no double
 * charge on retries or double clicks), while a later regenerate gets a new one.
 */
export function autoIdempotencyKey(input: {
  tenantId: string;
  actorUserId: string;
  useCase: string;
  sourceEntityId: string;
  inputHash: string;
  now?: number;
}) {
  const bucket = Math.floor((input.now ?? Date.now()) / AUTO_IDEMPOTENCY_WINDOW_MS);
  const digest = createHash('sha256')
    .update(`${input.tenantId}:${input.actorUserId}:${input.sourceEntityId}:${input.inputHash}`)
    .digest('hex')
    .slice(0, 32);
  return `auto:${input.useCase}:${digest}:${bucket}`;
}

function failureStatus(code: string): 'FAILED' | 'SCHEMA_INVALID' | 'REFUSED' | 'DISABLED' {
  if (code === 'SCHEMA_INVALID') return 'SCHEMA_INVALID';
  if (code === 'REFUSAL' || code === 'CONTENT_FILTER') return 'REFUSED';
  if (code === 'AI_DISABLED' || code === 'NOT_CONFIGURED' || code === 'BILLING_NOT_ENABLED')
    return 'DISABLED';
  return 'FAILED';
}

/**
 * Single runner for live/test structured AI calls (DEC-027):
 * reserve budget under a tenant lock and persist the run as RUNNING, call the
 * provider, then settle (success) or fail (with the billed cost) the same row.
 */
export async function runStructuredGeneration<T>(input: {
  tenantId: string;
  actorUserId: string;
  useCase: AiUseCase;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceVersion: string;
  /** Explicit key (header/body). Without one, a deterministic short-window key is used. */
  idempotencyKey?: string | null;
  correlationId?: string;
  prompt: PromptSpec & { estimatedTokens: number };
  schema: Record<string, unknown>;
  /** Output contract id and version (ai/contracts). */
  contractId?: string;
  schemaVersion?: string;
  parse: (raw: unknown) => StructuredParse<T>;
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
  const inputHash = structuredInputHash(input.prompt, input.schema);
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    autoIdempotencyKey({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      useCase: input.useCase,
      sourceEntityId: input.sourceEntityId,
      inputHash,
    });

  const existing = await getPrisma().aiRun.findUnique({
    where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey } },
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
  if (
    existing &&
    (existing.status === 'RUNNING' || existing.status === 'QUEUED') &&
    Date.now() - existing.createdAt.getTime() < AI_RESERVATION_STALE_MS
  ) {
    throw new DomainError(
      'CONFLICT_STATE',
      'This AI request is already running.',
      409,
      'errors.conflict_state',
      [{ code: 'AI_RUN_IN_PROGRESS', run_id: existing.id }],
    );
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

  const limits = aiBudgetLimitsFromEnv();
  const maxOutputTokens = limits.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const priceTable = parsePriceTable(process.env.AI_MODEL_PRICES_JSON);
  const routed = routeModel(input.useCase, defaultAiModels());
  const provider = useTest ? 'test-adapter' : configuredAiProvider();
  const plannedModel = useTest ? 'test-adapter-v1' : routed.model;
  const reserveUsd = useTest
    ? TEST_RESERVE_USD
    : estimateReserveUsd({
        model: routed.model,
        estimatedInputTokens: input.prompt.estimatedTokens,
        maxOutputTokens,
        table: priceTable,
      });
  const metadata = {
    promptId: input.prompt.promptId,
    promptVersion: input.prompt.promptVersion,
    brandProfileVersionId: input.brandProfileVersionId ?? null,
    ...input.metadata,
  };
  const runId = existing?.id ?? newId();
  const reservation = await reserveAiRun({
    tenantId: input.tenantId,
    runId,
    reuse: Boolean(existing),
    reserveUsd,
    limits,
    estimatedInputTokens: input.prompt.estimatedTokens,
    maxOutputTokens,
    data: {
      actorUserId: input.actorUserId,
      useCase: input.useCase,
      provider,
      model: plannedModel,
      promptVersion: input.prompt.promptVersion,
      promptId: input.prompt.promptId,
      schemaVersion: input.schemaVersion ?? '1',
      contractId: input.contractId ?? null,
      metadataJson: JSON.stringify(metadata),
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      sourceVersion: input.sourceVersion,
      idempotencyKey,
      correlationId: input.correlationId,
      inputHash,
      inputTokens: input.prompt.estimatedTokens,
      outputTokens: 0,
      estimatedCost: String(reserveUsd),
      latencyMs: null,
      attemptCount: 1,
    },
  });
  if (!reservation.ok) {
    throw new DomainError('BUDGET_EXCEEDED', 'AI budget exceeded', 429, 'errors.budget_exceeded', [
      { manual_journey: true, scope: reservation.decision.scope },
    ]);
  }

  const started = Date.now();
  const fail = async (
    code: string,
    stage: AiRunFailureStage,
    usage: { model?: string; inputTokens?: number; outputTokens?: number } = {},
    refusalReason?: string,
  ) => {
    const model = usage.model ?? plannedModel;
    const costUsd = useTest
      ? 0
      : computeCostUsd(model, usage.inputTokens ?? 0, usage.outputTokens ?? 0, priceTable);
    await failAiRun(runId, {
      status: failureStatus(code),
      errorCode: code,
      failureStage: stage,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd,
      latencyMs: Date.now() - started,
      attemptCount: 1,
      refusalReason: refusalReason ?? null,
    });
  };

  let raw: unknown;
  let model = plannedModel;
  let inputTokens = estimateTokens(input.prompt.user);
  let outputTokens = 64;
  try {
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
          return checked.ok
            ? { ok: true as const, value: checked.value }
            : { ok: false as const, issues: checked.issues };
        },
      });
      if (!result.ok) {
        const stage: AiRunFailureStage =
          result.stage === 'parse' ? 'parse' : result.stage === 'schema' ? 'schema' : 'provider';
        await fail(
          result.code,
          stage,
          result,
          result.code === 'REFUSAL' ? (result.message ?? 'REFUSAL') : undefined,
        );
        throwForStructuredCode(result.code, result.message);
      }
      raw = result.output;
      model = result.model;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    }
  } catch (err) {
    const current = await getPrisma().aiRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    if (current?.status === 'RUNNING') await fail('PROVIDER_ERROR', 'provider');
    throw err;
  }

  const parsed = input.parse(raw);
  if (!parsed.ok) {
    await fail('SCHEMA_INVALID', 'schema', { model, inputTokens, outputTokens });
    throw new DomainError(
      'SCHEMA_INVALID',
      'Model output failed schema validation',
      422,
      'errors.schema_invalid',
      parsed.issues?.length ? [{ issues: parsed.issues.slice(0, 10) }] : [],
    );
  }

  const costUsd = useTest
    ? TEST_RESERVE_USD
    : computeCostUsd(model, inputTokens, outputTokens, priceTable);
  await billingService.consumeUsage(input.tenantId, 'ai_credits_per_month', 1);
  const serialized = input.serialize(parsed.value);
  const proposalJson = JSON.stringify(serialized);
  await settleAiRun(runId, {
    model,
    provider,
    inputTokens,
    outputTokens,
    costUsd,
    latencyMs: Date.now() - started,
    attemptCount: 1,
    proposalJson,
    outputHash: createHash('sha256').update(proposalJson).digest('hex'),
  });

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
