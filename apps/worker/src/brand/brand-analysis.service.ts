import { createHash } from 'node:crypto';
import { consumeAiCreditOnce, getPrisma, tenantAllowsAiAssist } from '@oma/db';
import {
  computeCostUsd,
  defaultAiModels,
  deterministicProposal,
  estimateReserveUsd,
  evaluateBudget,
  insightWritesFromProposal,
  isAiLiveEnabled,
  mergeAiSections,
  newId,
  parsePriceTable,
  shouldSkipApprovedProfile,
  snapshotLedger,
  testAdapterAllowed,
  validateProposal,
  visualIdentityFromObservations,
  type LedgerEntry,
} from '@oma/domain';
import { createAiAdapterFromEnv, configuredAiProvider, buildBrandAnalysisPrompt } from '@oma/ai';

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
    maxInputTokens: budgetLimits().maxInputTokens ?? 6000,
  });

  const models = defaultAiModels();
  const priceTable = parsePriceTable(process.env.AI_MODEL_PRICES_JSON);
  const reserveUsd = useTest
    ? 0.25
    : estimateReserveUsd({
        model: models.reasoningModel,
        estimatedInputTokens: prompt.estimatedTokens,
        maxOutputTokens: budgetLimits().maxOutputTokens ?? 1500,
        table: priceTable,
      });
  const snapshot = await budgetSnapshot(input.tenantId);
  const budget = evaluateBudget({
    limits: budgetLimits(),
    snapshot,
    reserveUsd,
    inputTokens: prompt.estimatedTokens,
    outputTokens: budgetLimits().maxOutputTokens ?? 1500,
  });
  if (!budget.ok) {
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'FAILED',
      aiAvailability: 'SKIPPED',
      analysisErrorCode: 'BUDGET_EXCEEDED',
    });
    return { ok: false, reason: 'BUDGET_EXCEEDED' };
  }

  const started = Date.now();
  let proposal = useTest
    ? deterministicProposal({
        useCase: 'brand_profile_synthesis',
        evidenceRefs: evidence.map((item) => item.id),
        sourceVersion: profile.id,
        language: prompt.language,
      })
    : null;
  let inputTokens = prompt.estimatedTokens;
  let outputTokens = 32;
  let model = useTest ? 'test-adapter-v1' : models.reasoningModel;
  let errorCode: string | null = null;

  if (live && !useTest) {
    const adapter = createAiAdapterFromEnv();
    const result = await adapter.completeStructured({
      useCase: 'brand_profile_synthesis',
      payload: { scanAttemptId: input.scanAttemptId },
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
    });
    if (!result.ok) {
      errorCode = result.code;
    } else {
      proposal = result.proposal;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      model = result.model;
    }
  }

  if (proposal && !validateProposal(proposal).ok) {
    proposal = null;
    errorCode = 'SCHEMA_INVALID';
  }

  const settledCost = proposal
    ? useTest
      ? 0.25
      : computeCostUsd(model, inputTokens, outputTokens, priceTable)
    : 0;
  const inputHash = createHash('sha256')
    .update(`${input.tenantId}:brand_profile_synthesis:${input.scanAttemptId}:${profile.id}`)
    .digest('hex');

  if (proposal) {
    await consumeAiCreditOnce(input.tenantId);
    const writes = insightWritesFromProposal(proposal, knownEvidence);
    await prisma.$transaction(async (tx) => {
      const pendingAi = await tx.insightClaim.findMany({
        where: {
          tenantId: input.tenantId,
          profileVersionId: profile.id,
          createdBy: 'AI',
          reviewStatus: 'PENDING',
        },
      });
      if (pendingAi.length > 0) {
        await tx.insightClaim.deleteMany({ where: { id: { in: pendingAi.map((row) => row.id) } } });
      }
      for (const write of writes) {
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
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'ANALYZED',
      aiAvailability: 'USED',
      analysisErrorCode: null,
    });
  } else {
    await markAnalysis(input.tenantId, input.scanAttemptId, input.profileVersionId, {
      analysisStatus: 'FAILED',
      aiAvailability: 'UNAVAILABLE',
      analysisErrorCode: errorCode ?? 'AI_UNAVAILABLE',
    });
  }

  const run = existingRun
    ? await prisma.aiRun.update({
        where: { id: existingRun.id },
        data: {
          status: proposal
            ? 'SUCCEEDED'
            : errorCode === 'SCHEMA_INVALID'
              ? 'SCHEMA_INVALID'
              : 'FAILED',
          provider: useTest ? 'test-adapter' : configuredAiProvider(),
          model,
          promptVersion: proposal?.promptVersion ?? prompt.promptVersion,
          inputTokens,
          outputTokens,
          estimatedCost: String(settledCost),
          reservedCost: '0',
          settledCost: String(settledCost),
          proposalJson: proposal ? JSON.stringify(proposal) : null,
          outputHash: proposal
            ? createHash('sha256').update(JSON.stringify(proposal)).digest('hex')
            : null,
          errorCode,
          latencyMs: Date.now() - started,
          version: { increment: 1 },
        },
      })
    : await prisma.aiRun.create({
        data: {
          id: newId(),
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          useCase: 'brand_profile_synthesis',
          provider: useTest ? 'test-adapter' : configuredAiProvider(),
          model,
          promptVersion: proposal?.promptVersion ?? prompt.promptVersion,
          schemaVersion: '1',
          sourceEntityType: 'scan_attempt',
          sourceEntityId: input.scanAttemptId,
          sourceVersion: profile.id,
          status: proposal
            ? 'SUCCEEDED'
            : errorCode === 'SCHEMA_INVALID'
              ? 'SCHEMA_INVALID'
              : 'FAILED',
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          inputHash,
          outputHash: proposal
            ? createHash('sha256').update(JSON.stringify(proposal)).digest('hex')
            : null,
          proposalJson: proposal ? JSON.stringify(proposal) : null,
          errorCode,
          inputTokens,
          outputTokens,
          estimatedCost: String(settledCost),
          reservedCost: '0',
          settledCost: String(settledCost),
          latencyMs: Date.now() - started,
        },
      });

  return { ok: Boolean(proposal), runId: run.id, errorCode };
}
