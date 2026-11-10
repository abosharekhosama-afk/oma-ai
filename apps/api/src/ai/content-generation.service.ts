import {
  DomainError,
  applyGenerationModeration,
  channelLimits,
  contentGenerationJsonSchema,
  deterministicGeneration,
  isAiAnalysisAvailable,
  kindToUseCase,
  moderateGeneratedText,
  validateContentGeneration,
  type ContentGenerationKind,
  type ContentLength,
} from '@oma/domain';
import { buildContentGenerationPrompt, buildInboxReplyPrompt } from '@oma/ai';
import { loadBrandContext } from './brand-context.service';
import { runStructuredGeneration } from './structured-run';

function detectLanguage(input?: string | null): 'en' | 'ar' {
  const raw = (input ?? '').toLowerCase();
  if (raw.startsWith('ar')) return 'ar';
  return 'en';
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
  idempotencyKey: string;
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

  const prompt = buildContentGenerationPrompt({
    kind,
    language,
    brand,
    channel: input.channel,
    caption: input.caption,
    title: input.title,
    tone: input.tone,
    length: input.length,
    variantCount: input.variantCount,
  });

  const run = await runStructuredGeneration<ReturnType<typeof deterministicGeneration>>({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    useCase: kindToUseCase(kind),
    sourceEntityType: input.contentId ? 'content' : 'brand',
    sourceEntityId: input.contentId || input.brandId,
    sourceVersion: brand.profileVersionId ?? 'none',
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    prompt,
    schema: contentGenerationJsonSchema(),
    parse: (raw) => {
      const checked = validateContentGeneration(raw);
      return checked.ok ? { ok: true as const, value: checked.result } : { ok: false as const };
    },
    testValue: () =>
      deterministicGeneration({
        kind,
        language,
        sourceVersion: brand.profileVersionId ?? 'none',
        brandName: brand.brandName,
        channel: input.channel,
        caption: input.caption,
      }),
    serialize: (value) => value,
    brandProfileVersionId: brand.profileVersionId,
    metadata: { kind, channel: limits.channel, language },
  });

  const moderated = applyGenerationModeration(run.value, brand, limits);
  const usable = moderated.variants.filter(
    (variant) => moderateGeneratedText(variant.text, brand).ok,
  );
  if (!usable.length) {
    throw new DomainError(
      'AI_REFUSED',
      'Generated copy used banned or rejected brand claims.',
      422,
      'errors.ai_refused',
      [{ code: 'BANNED_CLAIM', manual_journey: true }],
    );
  }

  return {
    source: 'ai' as const,
    availability: 'AVAILABLE' as const,
    used_approved_profile: brand.usedApprovedProfile,
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
    banner: moderated.banner,
    variants: usable,
    hashtags: moderated.hashtags,
    warnings: moderated.warnings,
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
  idempotencyKey: string;
  correlationId?: string;
}) {
  const brand = await loadBrandContext(input.tenantId, input.brandId);
  const language = detectLanguage(input.language ?? brand.languages[0]);
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
  const run = await runStructuredGeneration<ReturnType<typeof deterministicGeneration>>({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    useCase: 'inbox_reply',
    sourceEntityType: 'inbox_conversation',
    sourceEntityId: input.conversationId,
    sourceVersion: brand.profileVersionId ?? 'none',
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    prompt,
    schema: contentGenerationJsonSchema(),
    parse: (raw) => {
      const checked = validateContentGeneration(raw);
      return checked.ok ? { ok: true as const, value: checked.result } : { ok: false as const };
    },
    testValue: () =>
      deterministicGeneration({
        kind: 'inbox_reply',
        language,
        sourceVersion: brand.profileVersionId ?? 'none',
        brandName: brand.brandName,
        channel: input.channel,
      }),
    serialize: (value) => value,
    brandProfileVersionId: brand.profileVersionId,
    metadata: { kind: 'inbox_reply', language, autoSent: false },
  });
  const limits = channelLimits(input.channel ?? 'instagram');
  const moderated = applyGenerationModeration(run.value, brand, limits);
  return {
    source: 'ai' as const,
    auto_sent: false,
    availability: 'AVAILABLE' as const,
    used_approved_profile: brand.usedApprovedProfile,
    brand_profile_version_id: brand.profileVersionId,
    brand_name: brand.brandName,
    language,
    run_id: run.runId,
    replayed: run.replayed,
    model: run.model,
    prompt_id: prompt.promptId,
    prompt_version: prompt.promptVersion,
    banner: moderated.banner,
    variants: moderated.variants,
    warnings: moderated.warnings,
  };
}
