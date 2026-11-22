import {
  DomainError,
  buildContractFor,
  channelLimits,
  detectTextLanguage,
  deterministicGroundedGeneration,
  isAiAnalysisAvailable,
  kindToUseCase,
  lengthBudget,
  moderateGroundedOutput,
  type BrandContext,
  type ContentContractKind,
  type ContentGenerationKind,
  type ContentGenerationV2,
  type ContentLength,
  type GroundedOutput,
  type GroundingContext,
} from '@oma/domain';
import { buildContentGenerationPrompt, buildInboxReplyPrompt } from '@oma/ai';
import { loadBrandContext } from './brand-context.service';
import { runStructuredGeneration } from './structured-run';
import { loadStrategyContentContext } from './strategy-content-context.service';

function detectLanguage(input?: string | null): 'en' | 'ar' {
  const raw = (input ?? '').toLowerCase();
  if (raw.startsWith('ar')) return 'ar';
  return 'en';
}

/** Refuse when moderation removed every variant (banned words or rejected claims). */
function assertUsable(out: GroundedOutput<ContentGenerationV2>, autoSent?: false) {
  if (out.value.variants.length) return;
  throw new DomainError(
    'AI_REFUSED',
    'Generated copy used banned or rejected brand claims.',
    422,
    'errors.ai_refused',
    [
      {
        code: 'BANNED_CLAIM',
        manual_journey: true,
        dropped: out.dropped,
        ...(autoSent === false ? { auto_sent: false } : {}),
      },
    ],
  );
}

function groundedVariants(out: GroundedOutput<ContentGenerationV2>, brand: BrandContext) {
  const byRef = new Map(out.refs.map((r) => [r.ref, r]));
  return out.value.variants.map((variant) => ({
    text: variant.text,
    rationale: variant.rationale,
    factual: variant.factual,
    grounding_refs: variant.groundingRefs
      .map((ref) => byRef.get(ref))
      .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    ...(brand.usedApprovedProfile ? {} : { generic: true }),
  }));
}

/** Shared structured run for every v2 content kind. */
async function runGroundedContent(input: {
  tenantId: string;
  actorUserId: string;
  kind: ContentContractKind;
  ctx: GroundingContext;
  prompt: Parameters<typeof runStructuredGeneration>[0]['prompt'];
  sourceEntityType: string;
  sourceEntityId: string;
  idempotencyKey?: string;
  correlationId?: string;
  caption?: string;
  metadata: Record<string, unknown>;
}) {
  const contract = buildContractFor(input.kind, input.ctx);
  const run = await runStructuredGeneration<ContentGenerationV2>({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    useCase: input.kind === 'inbox_reply' ? 'inbox_reply' : kindToUseCase(input.kind),
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    sourceVersion: input.ctx.brand.profileVersionId ?? 'none',
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    prompt: input.prompt,
    schema: contract.jsonSchema(),
    contractId: contract.contractId,
    schemaVersion: contract.schemaVersion,
    parse: contract.parse,
    testValue: () =>
      deterministicGroundedGeneration({
        kind: input.kind,
        ctx: input.ctx,
        promptId: input.prompt.promptId,
        promptVersion: input.prompt.promptVersion,
        caption: input.caption,
      }),
    serialize: (value) => value,
    brandProfileVersionId: input.ctx.brand.profileVersionId,
    metadata: {
      ...input.metadata,
      grounded: input.ctx.brand.usedApprovedProfile,
      allowedRefs: input.ctx.brand.groundingRefs.length,
    },
  });
  const moderated = moderateGroundedOutput(run.value, input.ctx.brand);
  return { run, moderated };
}

export async function generateBrandContent(input: {
  tenantId: string;
  actorUserId: string;
  brandId: string;
  kind: ContentGenerationKind;
  channel?: string;
  language?: string;
  caption?: string;
  title?: string;
  tone?: string;
  length?: ContentLength;
  variantCount?: number;
  contentId?: string;
  idempotencyKey?: string;
  correlationId?: string;
}) {
  const brand = await loadBrandContext(input.tenantId, input.brandId);
  const language = detectLanguage(input.language ?? brand.languages[0]);
  const kind: ContentGenerationKind =
    input.kind === 'caption' && input.caption?.trim() ? 'rewrite' : input.kind;
  const limits = channelLimits(input.channel);

  if (!isAiAnalysisAvailable()) {
    throw new DomainError(
      'AI_NOT_CONFIGURED',
      'AI is not configured. Continue manually.',
      503,
      'errors.ai_not_configured',
      [{ code: 'NOT_CONFIGURED', manual_journey: true, fallback: 'template' }],
    );
  }

  const strategy = await loadStrategyContentContext(
    input.tenantId,
    input.brandId,
    input.contentId,
    language,
  );
  const prompt = buildContentGenerationPrompt({
    kind,
    language,
    brand,
    strategy,
    channel: input.channel,
    caption: input.caption,
    title: input.title,
    tone: input.tone,
    length: input.length,
    variantCount: input.variantCount,
  });

  const { run, moderated } = await runGroundedContent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    kind,
    ctx: {
      brand,
      limits,
      maxChars: lengthBudget(input.length, limits),
      language,
      variantCount: input.variantCount,
    },
    prompt,
    sourceEntityType: input.contentId ? 'content' : 'brand',
    sourceEntityId: input.contentId || input.brandId,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    caption: input.caption,
    metadata: {
      kind,
      channel: limits.channel,
      language,
      strategyVersionId: strategy?.strategy_version_id ?? null,
      pillarKey: strategy?.pillar_key ?? null,
    },
  });
  assertUsable(moderated);

  return {
    source: 'ai' as const,
    availability: 'AVAILABLE' as const,
    used_approved_profile: brand.usedApprovedProfile,
    grounded: moderated.grounded,
    brand_profile_version_id: brand.profileVersionId,
    brand_name: brand.brandName,
    language,
    channel: limits.channel,
    kind,
    run_id: run.runId,
    replayed: run.replayed,
    model: run.model,
    prompt_id: prompt.promptId,
    prompt_version: prompt.promptVersion,
    schema_version: moderated.value.schemaVersion,
    banner: moderated.value.banner,
    variants: groundedVariants(moderated, brand),
    hashtags: moderated.value.hashtags,
    grounding_refs: moderated.refs,
    warnings: moderated.warnings,
    strategy_context: strategy
      ? {
          strategy_version_id: strategy.strategy_version_id,
          pillar_key: strategy.pillar_key,
          pillar_name: strategy.pillar_name,
          target_keyword: strategy.target_keyword,
        }
      : null,
  };
}

export async function generateInboxDraft(input: {
  tenantId: string;
  actorUserId: string;
  brandId: string;
  conversationId: string;
  language?: string;
  channel?: string;
  messages: Array<{ direction: string; content: string; senderName?: string | null }>;
  idempotencyKey?: string;
  correlationId?: string;
}) {
  const brand = await loadBrandContext(input.tenantId, input.brandId);
  const lastInbound = [...input.messages].reverse().find((m) => m.direction !== 'OUTBOUND');
  const language = input.language
    ? detectLanguage(input.language)
    : (detectTextLanguage(lastInbound?.content ?? '') ?? detectLanguage(brand.languages[0]));
  if (!isAiAnalysisAvailable()) {
    throw new DomainError(
      'AI_NOT_CONFIGURED',
      'AI is not configured. Continue manually.',
      503,
      'errors.ai_not_configured',
      [{ code: 'NOT_CONFIGURED', manual_journey: true, fallback: 'template', auto_sent: false }],
    );
  }
  const prompt = buildInboxReplyPrompt({
    language,
    brand,
    channel: input.channel,
    messages: input.messages,
  });
  const limits = channelLimits(input.channel ?? 'instagram');
  const { run, moderated } = await runGroundedContent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    kind: 'inbox_reply',
    ctx: { brand, limits, maxChars: limits.captionMax, language },
    prompt,
    sourceEntityType: 'inbox_conversation',
    sourceEntityId: input.conversationId,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    metadata: { kind: 'inbox_reply', language, autoSent: false },
  });
  assertUsable(moderated, false);
  return {
    source: 'ai' as const,
    auto_sent: false,
    availability: 'AVAILABLE' as const,
    used_approved_profile: brand.usedApprovedProfile,
    grounded: moderated.grounded,
    brand_profile_version_id: brand.profileVersionId,
    brand_name: brand.brandName,
    language,
    run_id: run.runId,
    replayed: run.replayed,
    model: run.model,
    prompt_id: prompt.promptId,
    prompt_version: prompt.promptVersion,
    schema_version: moderated.value.schemaVersion,
    banner: moderated.value.banner,
    variants: groundedVariants(moderated, brand),
    grounding_refs: moderated.refs,
    warnings: moderated.warnings,
  };
}
