import type { Prisma, PrismaClient } from '@prisma/client';
import {
  evaluateBudget,
  snapshotAiRuns,
  type BudgetDecision,
  type BudgetLimits,
} from '@oma/domain';
import { getPrisma } from './prisma.service';

type Tx = Prisma.TransactionClient | PrismaClient;

function monthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Budget snapshot for the current UTC month (spent + live reservations). */
export async function tenantAiLedgerSnapshot(
  tenantId: string,
  now: Date = new Date(),
  client: Tx = getPrisma(),
) {
  const runs = await client.aiRun.findMany({
    where: { tenantId, createdAt: { gte: monthStart(now) } },
    select: { reservedCost: true, settledCost: true, status: true, createdAt: true },
  });
  return snapshotAiRuns(tenantId, runs, now);
}

export type AiRunReservationData = Omit<
  Prisma.AiRunUncheckedCreateInput,
  'id' | 'status' | 'reservedCost' | 'tenantId'
>;

export type AiRunReservation =
  | { ok: true; runId: string; snapshot: Awaited<ReturnType<typeof tenantAiLedgerSnapshot>> }
  | { ok: false; decision: Extract<BudgetDecision, { ok: false }> };

/**
 * Reserve budget and persist the run as RUNNING before any provider call.
 * A per-tenant advisory lock serialises the check-and-reserve, so concurrent
 * requests cannot both pass a budget that only fits one of them.
 */
export async function reserveAiRun(input: {
  tenantId: string;
  runId: string;
  /** Reuse an existing (failed/legacy) row with this id instead of creating one. */
  reuse: boolean;
  reserveUsd: number;
  limits: BudgetLimits;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  data: AiRunReservationData;
}): Promise<AiRunReservation> {
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-budget:${input.tenantId}`}))`;
    const snapshot = await tenantAiLedgerSnapshot(input.tenantId, new Date(), tx);
    const decision = evaluateBudget({
      limits: input.limits,
      snapshot,
      reserveUsd: input.reserveUsd,
      inputTokens: input.estimatedInputTokens,
      outputTokens: input.maxOutputTokens,
    });
    if (!decision.ok) return { ok: false as const, decision };
    const row = {
      ...input.data,
      tenantId: input.tenantId,
      status: 'RUNNING' as const,
      reservedCost: String(input.reserveUsd),
      settledCost: '0',
      errorCode: null,
      failureStage: null,
      proposalJson: null,
      outputHash: null,
    };
    if (input.reuse) {
      await tx.aiRun.update({
        where: { id: input.runId },
        data: { ...row, createdAt: new Date(), version: { increment: 1 } },
      });
    } else {
      await tx.aiRun.create({ data: { id: input.runId, ...row } });
    }
    return { ok: true as const, runId: input.runId, snapshot };
  });
}

/** Settle a successful run: release the reservation and record the real cost. */
export async function settleAiRun(
  runId: string,
  data: {
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
    attemptCount: number;
    proposalJson: string;
    outputHash: string;
    promptVersion?: string;
    metadataJson?: string;
  },
  client: Tx = getPrisma(),
) {
  return client.aiRun.update({
    where: { id: runId },
    data: {
      status: 'SUCCEEDED',
      model: data.model,
      provider: data.provider,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      estimatedCost: String(data.costUsd),
      reservedCost: '0',
      settledCost: String(data.costUsd),
      latencyMs: Math.max(0, Math.round(data.latencyMs)),
      attemptCount: data.attemptCount,
      proposalJson: data.proposalJson,
      outputHash: data.outputHash,
      errorCode: null,
      failureStage: null,
      ...(data.promptVersion ? { promptVersion: data.promptVersion } : {}),
      ...(data.metadataJson ? { metadataJson: data.metadataJson } : {}),
    },
  });
}

export type AiRunFailureStage = 'budget' | 'provider' | 'parse' | 'schema' | 'semantic';

/**
 * Record a failed run: release the reservation, keep the cost of tokens the
 * provider already billed (counted in the USD budget, DEC-027 #8).
 */
export async function failAiRun(
  runId: string,
  data: {
    status: 'FAILED' | 'SCHEMA_INVALID' | 'REFUSED' | 'DISABLED';
    errorCode: string;
    failureStage: AiRunFailureStage;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    latencyMs: number;
    attemptCount: number;
    refusalReason?: string | null;
  },
  client: Tx = getPrisma(),
) {
  const cost = Math.max(0, data.costUsd ?? 0);
  return client.aiRun.update({
    where: { id: runId },
    data: {
      status: data.status,
      errorCode: data.errorCode,
      failureStage: data.failureStage,
      ...(data.model ? { model: data.model } : {}),
      inputTokens: data.inputTokens ?? 0,
      outputTokens: data.outputTokens ?? 0,
      estimatedCost: String(cost),
      reservedCost: '0',
      settledCost: String(cost),
      latencyMs: Math.max(0, Math.round(data.latencyMs)),
      attemptCount: data.attemptCount,
      refusalReason: data.refusalReason ?? null,
      proposalJson: null,
      outputHash: null,
    },
  });
}
