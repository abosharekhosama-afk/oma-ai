import { createHash } from 'node:crypto';
import {
  consumeAiCreditOnce,
  failAiRun,
  getPrisma,
  reserveAiRun,
  settleAiRun,
  tenantAllowsAiAssist,
  type AiRunFailureStage,
} from '@oma/db';
import {
  AI_RESERVATION_STALE_MS,
  aiBudgetLimitsFromEnv,
  computeCostUsd,
  defaultAiModels,
  assertAiWriteTarget,
  brandAnalysisContractFor,
  deterministicBrandAnalysisV2,
  type BrandAnalysisV2,
  estimateReserveUsd,
  insightWritesFromProposal,
  isAiLiveEnabled,
  mergeAiSections,
  newId,
  parsePriceTable,
  shouldSkipApprovedProfile,
  testAdapterAllowed,
  visualIdentityFromObservations,
} from '@oma/domain';
import {
  createAiAdapterFromEnv,
  configuredAiProvider,
  buildBrandAnalysisPrompt,
  brandAnalysisTimeoutMs,
} from '@oma/ai';

async function markAnalysis(
  tenantId: string,
  scanAttemptId: string,
  profileVersionId: string,
  data: {
    analysisStatus: 'ANALYZING' | 'ANALYZED' | 'FAILED' | 'SKIPPED';
    aiAvailability?: 'NOT_CONFIGURED' | 'UNAVAILABLE' | 'USED' | 'SKIPPED';
    analysisErrorCode?: string | null;
  },
) {
  await getPrisma().scanAttempt.updateMany({
    where: { id: scanAttemptId, tenantId },
    data: {
      analysisStatus: data.analysisStatus,
      ...(data.aiAvailability ? { aiAvailability: data.aiAvailability } : {}),
      analysisErrorCode: data.analysisErrorCode ?? null,
    },
  });
  await getPrisma().profileVersion.updateMany({
    where: { id: profileVersionId, tenantId },
    data: {
      analysisStatus: data.analysisStatus,
      ...(data.aiAvailability ? { aiAvailability: data.aiAvailability } : {}),
    },
  });
}

export type BrandAnalysisResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  runId?: string;
  errorCode?: string | null;
};

export async function runBrandProfileAnalysis(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  profileVersionId: string;
  actorUserId: string;
  correlationId?: string | null;
  idempotencyKey: string;
}): Promise<BrandAnalysisResult> {
  const prisma = getPrisma();
  const scan = await prisma.scanAttempt.findFirst({
    where: { id: input.scanAttemptId, tenantId: input.tenantId, brandId: input.brandId },
  });
  if (!scan) throw new Error('scan_attempt not found or mismatched');
  if (scan.cancelRequestedAt || scan.status === 'CANCELLED') {
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'SKIPPED',
      aiAvailability: 'SKIPPED',
      analysisErrorCode: 'CANCELLED',
    });
    return { ok: true, skipped: true, reason: 'cancelled' };
  }

  const profile = await prisma.profileVersion.findFirst({
    where: { id: input.profileVersionId, tenantId: input.tenantId, brandId: input.brandId },
  });
  if (!profile) throw new Error('profile_version not found or mismatched');
  if (shouldSkipApprovedProfile(profile.status)) {
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'SKIPPED',
      analysisErrorCode: 'APPROVED_VERSION_IMMUTABLE',
    });
    return { ok: true, skipped: true, reason: 'approved_immutable' };
  }

  const existingRun = await prisma.aiRun.findUnique({
    where: {
      tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
    },
  });
  if (existingRun?.status === 'SUCCEEDED' && existingRun.proposalJson) {
    return { ok: true, skipped: true, reason: 'idempotent', runId: existingRun.id };
  }
  if (
    existingRun &&
    (existingRun.status === 'RUNNING' || existingRun.status === 'QUEUED') &&
    Date.now() - existingRun.createdAt.getTime() < AI_RESERVATION_STALE_MS
  ) {
    return { ok: true, skipped: true, reason: 'in_progress', runId: existingRun.id };
  }

  const useTest = testAdapterAllowed(process.env);
  const live = isAiLiveEnabled();
  if (!useTest && !live) {
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'SKIPPED',
      aiAvailability: 'NOT_CONFIGURED',
      analysisErrorCode: 'NOT_CONFIGURED',
    });
    return { ok: true, skipped: true, reason: 'NOT_CONFIGURED' };
  }
  if (!(await tenantAllowsAiAssist(input.tenantId))) {
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'SKIPPED',
      aiAvailability: 'SKIPPED',
      analysisErrorCode: 'PLAN_FEATURE_REQUIRED',
    });
    return { ok: true, skipped: true, reason: 'PLAN_FEATURE_REQUIRED' };
  }

  await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
    analysisStatus: 'ANALYZING',
  });

  const observations = await prisma.extractedObservation.findMany({
    where: { tenantId: input.tenantId, scanAttemptId: input.scanAttemptId },
  });
  const evidence = await prisma.evidenceExcerpt.findMany({
    where: { tenantId: input.tenantId, scanAttemptId: input.scanAttemptId },
  });
  const knownEvidence = new Set(evidence.map((item) => item.id));
  const contract = brandAnalysisContractFor([...knownEvidence]);
  const prompt = buildBrandAnalysisPrompt({
    useCase: 'brand_profile_synthesis',
    sourceVersion: profile.id,
    observations: observations.map((obs) => ({
      fieldKey: obs.fieldKey,
      value: obs.valueJson ? JSON.parse(obs.valueJson) : null,
      evidenceId: obs.evidenceId,
      isUnknown: obs.isUnknown,
    })),
    evidence: evidence.map((item) => ({
      id: item.id,
      url: item.canonicalUrl || item.sourceUrl,
      title: item.pageTitle ?? undefined,
      excerpt: item.excerptText,
    })),
    maxInputTokens: aiBudgetLimitsFromEnv().maxInputTokens ?? 6000,
  });

  const models = defaultAiModels();
  const priceTable = parsePriceTable(process.env.AI_MODEL_PRICES_JSON);
  const limits = aiBudgetLimitsFromEnv();
  const maxOutputTokens = limits.maxOutputTokens ?? 1500;
  const reserveUsd = useTest
    ? 0.25
    : estimateReserveUsd({
        model: models.reasoningModel,
        estimatedInputTokens: prompt.estimatedTokens,
        maxOutputTokens,
        table: priceTable,
      });
  const provider = useTest ? 'test-adapter' : configuredAiProvider();
  const plannedModel = useTest ? 'test-adapter-v1' : models.reasoningModel;
  const inputHash = createHash('sha256')
    .update(prompt.system)
    .update('\n---\n')
    .update(prompt.user)
    .digest('hex');
  const runId = existingRun?.id ?? newId();
  // Reserve budget and persist the run as RUNNING before calling the provider (DEC-027).
  const reservation = await reserveAiRun({
    tenantId: input.tenantId,
    runId,
    reuse: Boolean(existingRun),
    reserveUsd,
    limits,
    estimatedInputTokens: prompt.estimatedTokens,
    maxOutputTokens,
    data: {
      actorUserId: input.actorUserId,
      useCase: 'brand_profile_synthesis',
      provider,
      model: plannedModel,
      promptVersion: prompt.promptVersion,
      promptId: prompt.promptId,
      schemaVersion: contract.schemaVersion,
      contractId: contract.contractId,
      sourceEntityType: 'scan_attempt',
      sourceEntityId: input.scanAttemptId,
      sourceVersion: profile.id,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      inputHash,
      inputTokens: prompt.estimatedTokens,
      outputTokens: 0,
      estimatedCost: String(reserveUsd),
      latencyMs: null,
      attemptCount: 1,
    },
  });
  if (!reservation.ok) {
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'FAILED',
      aiAvailability: 'SKIPPED',
      analysisErrorCode: 'BUDGET_EXCEEDED',
    });
    return { ok: false, reason: 'BUDGET_EXCEEDED' };
  }

  const started = Date.now();
  let proposal: BrandAnalysisV2 | null = useTest
    ? deterministicBrandAnalysisV2({
        promptId: prompt.promptId,
        promptVersion: prompt.promptVersion,
        evidenceRefs: evidence.map((item) => item.id),
        sourceVersion: profile.id,
        language: prompt.language,
      })
    : null;
  let inputTokens = prompt.estimatedTokens;
  let outputTokens = 32;
  let model = plannedModel;
  let errorCode: string | null = null;
  let failureStage: AiRunFailureStage = 'provider';
  let refusalReason: string | null = null;
  let attempts = 1;

  if (live && !useTest) {
    try {
      const adapter = createAiAdapterFromEnv(process.env, {
        timeoutMs: brandAnalysisTimeoutMs(process.env),
      });
      const result = await adapter.completeStructured({
        useCase: 'brand_profile_synthesis',
        payload: { scanAttemptId: input.scanAttemptId },
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        schema: contract.jsonSchema(),
        validate: (raw) => {
          const checked = contract.parse(raw);
          return checked.ok
            ? { ok: true as const, value: checked.value }
            : { ok: false as const, issues: checked.issues };
        },
      });
      if (!result.ok) {
        errorCode = result.code;
        failureStage =
          result.stage === 'parse' ? 'parse' : result.stage === 'schema' ? 'schema' : 'provider';
        model = result.model ?? model;
        inputTokens = result.inputTokens ?? 0;
        outputTokens = result.outputTokens ?? 0;
        attempts = result.attempts ?? 1;
        if (result.code === 'REFUSAL') refusalReason = result.message ?? 'REFUSAL';
      } else {
        proposal = result.output as BrandAnalysisV2;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        model = result.model;
        attempts = result.attempts;
      }
    } catch (err) {
      errorCode = 'PROVIDER_ERROR';
      inputTokens = 0;
      outputTokens = 0;
      await failAiRun(runId, {
        status: 'FAILED',
        errorCode,
        failureStage: 'provider',
        model,
        latencyMs: Date.now() - started,
        attemptCount: 1,
      });
      await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
        analysisStatus: 'FAILED',
        aiAvailability: 'UNAVAILABLE',
        analysisErrorCode: errorCode,
      });
      throw err;
    }
  }

  if (proposal && !contract.parse(proposal).ok) {
    proposal = null;
    errorCode = 'SCHEMA_INVALID';
    failureStage = 'schema';
  }

  const callCost = useTest ? 0.25 : computeCostUsd(model, inputTokens, outputTokens, priceTable);

  if (proposal) {
    await consumeAiCreditOnce(input.tenantId);
    const writes = insightWritesFromProposal(proposal, knownEvidence);
    let applied = true;
    try {
      await prisma.$transaction(async (tx) => {
        // Draft-only invariant: lock the row and re-check it is still a draft (DEC-027 3.6).
        const locked = await tx.profileVersion.updateMany({
          where: {
            id: profile.id,
            tenantId: input.tenantId,
            status: { in: ['DRAFT', 'NEEDS_REVIEW'] },
          },
          data: { analysisStatus: 'ANALYZING' },
        });
        if (locked.count !== 1) {
          const current = await tx.profileVersion.findUniqueOrThrow({
            where: { id: profile.id },
            select: { status: true },
          });
          assertAiWriteTarget({ kind: 'profile_version', status: current.status });
        }
        const pendingAi = await tx.insightClaim.findMany({
          where: {
            tenantId: input.tenantId,
            profileVersionId: profile.id,
            createdBy: 'AI',
            reviewStatus: 'PENDING',
          },
        });
        if (pendingAi.length > 0) {
          await tx.insightClaim.deleteMany({
            where: { id: { in: pendingAi.map((row) => row.id) } },
          });
        }
        for (const write of writes) {
          assertAiWriteTarget({ kind: 'insight_claim', reviewStatus: 'PENDING' });
          await tx.insightClaim.create({
            data: {
              id: newId(),
              tenantId: input.tenantId,
              brandId: input.brandId,
              profileVersionId: profile.id,
              fieldKey: write.fieldKey,
              infoState: write.infoState,
              reviewStatus: 'PENDING',
              textValue: write.textValue,
              valueJson: write.valueJson,
              evidenceId: write.evidenceId,
              discoveryTier: write.discoveryTier as never,
              createdBy: 'AI',
              confidence: write.confidence,
            },
          });
        }
        const currentSections = profile.sectionsJson
          ? (JSON.parse(profile.sectionsJson) as Record<string, unknown>)
          : {};
        const nextSections = mergeAiSections(currentSections, proposal!, {
          visualIdentity: visualIdentityFromObservations(observations),
          aiRunId: runId,
        });
        await tx.profileVersion.update({
          where: { id: profile.id },
          data: {
            sectionsJson: JSON.stringify(nextSections),
            analysisStatus: 'ANALYZED',
            aiAvailability: 'USED',
          },
        });
      });
    } catch (err) {
      if (!isAiWriteForbidden(err)) throw err;
      // The profile was approved while the model was running: keep the proposal on the
      // run (it was paid for) but never touch the approved version.
      applied = false;
    }
    await markAnalysis(
      input.tenantId,
      input.scanAttemptId,
      input.profileVersionId,
      applied
        ? { analysisStatus: 'ANALYZED', aiAvailability: 'USED', analysisErrorCode: null }
        : { analysisStatus: 'SKIPPED', analysisErrorCode: 'APPROVED_VERSION_IMMUTABLE' },
    );
    const proposalJson = JSON.stringify(proposal);
    await settleAiRun(runId, {
      model,
      provider,
      inputTokens,
      outputTokens,
      costUsd: callCost,
      latencyMs: Date.now() - started,
      attemptCount: attempts,
      proposalJson,
      outputHash: createHash('sha256').update(proposalJson).digest('hex'),
      promptVersion: proposal.promptVersion,
    });
  } else {
    const code = errorCode ?? 'AI_UNAVAILABLE';
    await failAiRun(runId, {
      status:
        code === 'SCHEMA_INVALID'
          ? 'SCHEMA_INVALID'
          : code === 'REFUSAL' || code === 'CONTENT_FILTER'
            ? 'REFUSED'
            : 'FAILED',
      errorCode: code,
      failureStage,
      model,
      inputTokens,
      outputTokens,
      // Failed attempts that reached the provider still cost tokens (DEC-027 #8).
      costUsd: useTest ? 0 : callCost,
      latencyMs: Date.now() - started,
      attemptCount: attempts,
      refusalReason,
    });
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'FAILED',
      aiAvailability: 'UNAVAILABLE',
      analysisErrorCode: code,
    });
  }

  return { ok: Boolean(proposal), runId, errorCode };
}

function isAiWriteForbidden(err: unknown): boolean {
  const details = (err as { details?: Array<{ code?: string }> })?.details;
  return Array.isArray(details) && details.some((d) => d?.code === 'AI_WRITE_FORBIDDEN');
}
