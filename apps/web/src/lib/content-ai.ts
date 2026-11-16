import { api } from './api';

export type ContentAiKind = 'caption' | 'alt' | 'idea' | 'hashtags';

export type ContentAiGroundingRef = {
  ref: string;
  kind: 'claim' | 'profile';
  sourceId?: string;
  label: string;
};

export type ContentAiVariant = {
  text: string;
  rationale?: string;
  /** True when the variant states a brand fact; such variants must cite a ref (DEC-027 3.4). */
  factual?: boolean;
  groundingRefs?: ContentAiGroundingRef[];
  /** Brand had no approved profile: copy is generic, not grounded in brand facts. */
  generic?: boolean;
};

export type ContentAiProposal = {
  text: string;
  variants: ContentAiVariant[];
  source: 'template' | 'ai';
  banner: string;
  brandProfileVersionId?: string | null;
  usedApprovedProfile?: boolean;
  hashtags?: string[];
  /** AiRun id of a live AI proposal; sent back as `ai_run_ids` when the text is used (DEC-024). */
  runId?: string | null;
  /** Grounded in an approved brand profile (claims / profile sections cited). */
  grounded?: boolean;
  groundingRefs?: ContentAiGroundingRef[];
};

type ApiVariant = {
  text?: string;
  rationale?: string;
  factual?: boolean;
  grounding_refs?: Array<{ ref?: string; kind?: string; sourceId?: string; label?: string }>;
  generic?: boolean;
};

type ApiProposalData = {
  variants?: ApiVariant[];
  banner?: string;
  hashtags?: string[];
  brand_profile_version_id?: string | null;
  used_approved_profile?: boolean;
  run_id?: string | null;
  grounded?: boolean;
  grounding_refs?: ApiVariant['grounding_refs'];
  auto_sent?: boolean;
};

function mapRefs(refs: ApiVariant['grounding_refs']): ContentAiGroundingRef[] {
  return (refs ?? [])
    .filter((r) => r?.ref && r.label)
    .map((r) => ({
      ref: r.ref!,
      kind: r.kind === 'profile' ? ('profile' as const) : ('claim' as const),
      sourceId: r.sourceId,
      label: r.label!,
    }));
}

/** Map a v2 grounded API payload to the UI proposal shape (null when there is no usable text). */
export function mapAiProposal(
  data: ApiProposalData | undefined,
  locale: string,
): ContentAiProposal | null {
  const variants: ContentAiVariant[] = (data?.variants ?? [])
    .filter((item) => item.text?.trim())
    .map((item) => ({
      text: item.text!,
      rationale: item.rationale,
      factual: item.factual,
      groundingRefs: mapRefs(item.grounding_refs),
      generic: item.generic,
    }));
  if (!variants.length) return null;
  return {
    text: variants[0]!.text,
    variants,
    source: 'ai',
    banner: reviewBanner(locale, data?.banner ?? ''),
    brandProfileVersionId: data?.brand_profile_version_id ?? null,
    usedApprovedProfile: Boolean(data?.used_approved_profile),
    hashtags: data?.hashtags,
    runId: data?.run_id ?? null,
    grounded: Boolean(data?.grounded),
    groundingRefs: mapRefs(data?.grounding_refs),
  };
}

/**
 * Plain-language reason for an AI refusal or invalid output (no raw server text).
 * Returns null for errors that are not AI-output problems.
 */
export function aiRefusalReason(err: unknown, locale: string): string | null {
  const e = err as
    | {
        code?: string;
        data?: { error?: { code?: string; details?: Array<{ code?: string; dropped?: number }> } };
      }
    | undefined;
  const code = e?.code ?? e?.data?.error?.code;
  const detail = e?.data?.error?.details?.[0];
  const ar = isArLocale(locale);
  if (code === 'AI_REFUSED') {
    if (detail?.code === 'BANNED_CLAIM') {
      return ar
        ? 'تم حجب الاقتراح لأنه استخدم كلمات محظورة أو ادعاءات مرفوضة للعلامة. اكتب النص يدوياً أو حدّث ملف البراند.'
        : 'The suggestion was blocked because it used banned words or rejected brand claims. Write it manually or update the brand profile.';
    }
    return ar
      ? 'رفض النموذج هذا الطلب. يمكنك المتابعة يدوياً.'
      : 'The AI model declined this request. You can continue manually.';
  }
  if (code === 'SCHEMA_INVALID') {
    return ar
      ? 'أعاد الذكاء الاصطناعي نتيجة غير صالحة حتى بعد الإصلاح. حاول مرة أخرى أو اكتب النص يدوياً.'
      : 'The AI returned an invalid result even after a repair attempt. Try again or write it manually.';
  }
  return null;
}

function isArLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('ar');
}

function templateBanner(locale: string): string {
  return isArLocale(locale)
    ? 'قالب جاهز — ليس نموذجاً لغوياً حياً. راجع النص قبل النشر.'
    : 'Template suggestion — not a live AI model. Review before publishing.';
}

function reviewBanner(locale: string, fallback: string): string {
  return (
    fallback ||
    (isArLocale(locale)
      ? 'اقتراح ذكاء اصطناعي — يحتاج مراجعة بشرية قبل النشر'
      : 'AI proposal — requires human review before publishing')
  );
}

export function localContentProposal(input: {
  kind: ContentAiKind;
  locale: string;
  brandName?: string;
  channel?: string;
  caption?: string;
  title?: string;
}): string {
  const ar = isArLocale(input.locale);
  const brand = input.brandName?.trim() || (ar ? 'علامتك' : 'your brand');
  const channel = input.channel?.split(',')[0]?.trim() || 'Instagram';
  const caption = input.caption?.trim() || '';
  const title = input.title?.trim() || '';

  if (input.kind === 'hashtags') {
    const tag = `#${brand.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '')}`;
    return ar ? `${tag} #${channel}` : `${tag} #${channel}`;
  }

  if (input.kind === 'alt') {
    const src = caption || title;
    if (ar) {
      return src
        ? `صورة لمنشور ${channel} من ${brand}: ${src.slice(0, 140)}`
        : `صورة ترويجية لـ ${brand} على ${channel}`;
    }
    return src
      ? `${brand} ${channel} visual: ${src.slice(0, 140)}`
      : `Promotional image for ${brand} on ${channel}`;
  }

  if (input.kind === 'idea' || !caption) {
    if (ar) {
      return `جديد من ${brand} على ${channel}: نكهة تنعش يومك. جرّبوه وأخبرونا رأيكم. #${brand.replace(/\s+/g, '')}`;
    }
    return `New from ${brand} on ${channel}: a flavour that brightens the day. Try it and tell us what you think. #${brand.replace(/\s+/g, '')}`;
  }

  const words = caption.replace(/\s+/g, ' ').trim();
  const hashtag = `#${brand.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '')}`;
  if (ar) {
    const core = words.replace(/[.!?…]+$/u, '');
    return `${core} — من ${brand}. شاركونا رأيكم في التعليقات. ${hashtag}`;
  }
  const core = words.replace(/[.!?…]+$/u, '');
  return `${core} — from ${brand}. Tell us what you think in the comments. ${hashtag}`;
}

export function localInboxReply(input: {
  locale: string;
  brandName?: string;
  inbound?: string;
}): string {
  const ar = isArLocale(input.locale);
  const brand = input.brandName?.trim() || (ar ? 'فريقنا' : 'our team');
  const inbound = input.inbound?.trim();
  if (ar) {
    return inbound
      ? `شكراً على رسالتك. ${brand} اطّلع على تعليقك وسيعود إليك. هل نقدر نساعدك بشيء محدد؟`
      : `شكراً لتواصلك معنا. ${brand} سعيد بمساعدتك — أخبرنا كيف نقدر نخدمك.`;
  }
  return inbound
    ? `Thanks for writing in. ${brand} saw this and is here to help — anything specific we can do for you?`
    : `Thanks for reaching out. ${brand} is here to help — how can we support you today?`;
}

function asTemplate(input: {
  kind: ContentAiKind;
  locale: string;
  brandName?: string;
  channel?: string;
  caption?: string;
  title?: string;
}): ContentAiProposal {
  const text = localContentProposal(input);
  return {
    text,
    variants: [{ text, rationale: isArLocale(input.locale) ? 'قالب محلي' : 'Local template' }],
    source: 'template',
    banner: templateBanner(input.locale),
    brandProfileVersionId: null,
    usedApprovedProfile: false,
  };
}

function isFallbackError(err: unknown): boolean {
  const e = err as { code?: string; data?: { error?: { code?: string } } } | undefined;
  const code = e?.code ?? e?.data?.error?.code;
  return (
    code === 'AI_NOT_CONFIGURED' ||
    code === 'AI_DISABLED' ||
    code === 'BILLING_NOT_ENABLED' ||
    code === 'NOT_CONFIGURED'
  );
}

export async function proposeContentText(input: {
  kind: ContentAiKind;
  locale: string;
  brandName?: string;
  channel?: string;
  caption?: string;
  title?: string;
  contentId?: string;
  brandId?: string;
}): Promise<ContentAiProposal> {
  const template = asTemplate(input);
  if (!input.brandId) return template;
  try {
    const res = await api<{ data?: ApiProposalData }>(
      `/api/v1/brands/${input.brandId}/ai/generate`,
      {
        method: 'POST',
        headers: {
          'Idempotency-Key':
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `content-${input.kind}-${Date.now()}`,
        },
        body: JSON.stringify({
          kind: input.kind,
          channel: input.channel,
          language: input.locale,
          caption: input.caption,
          title: input.title,
          content_id: input.contentId,
        }),
      },
    );
    return mapAiProposal(res.data, input.locale) ?? template;
  } catch (err) {
    if (isFallbackError(err)) return template;
    throw err;
  }
}

export async function proposeInboxReply(input: {
  locale: string;
  conversationId: string;
  brandName?: string;
  inbound?: string;
}): Promise<ContentAiProposal> {
  const text = localInboxReply(input);
  const template: ContentAiProposal = {
    text,
    variants: [{ text, rationale: isArLocale(input.locale) ? 'قالب محلي' : 'Local template' }],
    source: 'template',
    banner: templateBanner(input.locale),
    brandProfileVersionId: null,
    usedApprovedProfile: false,
  };
  try {
    const res = await api<{ data?: ApiProposalData }>(
      `/api/v1/inbox/conversations/${input.conversationId}/ai/draft`,
      {
        method: 'POST',
        headers: {
          'Idempotency-Key':
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `inbox-${input.conversationId}-${Date.now()}`,
        },
        body: JSON.stringify({ language: input.locale }),
      },
    );
    return mapAiProposal(res.data, input.locale) ?? template;
  } catch (err) {
    if (isFallbackError(err)) return template;
    throw err;
  }
}

/** AI run ids to record after applying a proposal (template text is not AI output). */
export function appendAiRunId(
  current: string[],
  proposal: Pick<ContentAiProposal, 'source' | 'runId'>,
) {
  if (proposal.source !== 'ai' || !proposal.runId) return current;
  return current.includes(proposal.runId) ? current : [...current, proposal.runId];
}
