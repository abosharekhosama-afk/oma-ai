import { api } from './api';

export type ContentAiKind = 'caption' | 'alt' | 'idea' | 'hashtags';

export type ContentAiVariant = {
  text: string;
  rationale?: string;
};

export type ContentAiProposal = {
  text: string;
  variants: ContentAiVariant[];
  source: 'template' | 'ai';
  banner: string;
  brandProfileVersionId?: string | null;
  usedApprovedProfile?: boolean;
  hashtags?: string[];
};

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
  const code = (err as { code?: string } | undefined)?.code;
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
    const res = await api<{
      data?: {
        variants?: ContentAiVariant[];
        banner?: string;
        hashtags?: string[];
        brand_profile_version_id?: string | null;
        used_approved_profile?: boolean;
      };
    }>(`/api/v1/brands/${input.brandId}/ai/generate`, {
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
    });
    const variants = (res.data?.variants ?? []).filter((item) => item.text?.trim());
    if (!variants.length) return template;
    return {
      text: variants[0]!.text,
      variants,
      source: 'ai',
      banner: reviewBanner(input.locale, res.data?.banner ?? ''),
      brandProfileVersionId: res.data?.brand_profile_version_id ?? null,
      usedApprovedProfile: Boolean(res.data?.used_approved_profile),
      hashtags: res.data?.hashtags,
    };
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
    const res = await api<{
      data?: {
        variants?: ContentAiVariant[];
        banner?: string;
        brand_profile_version_id?: string | null;
        used_approved_profile?: boolean;
        auto_sent?: boolean;
      };
    }>(`/api/v1/inbox/conversations/${input.conversationId}/ai/draft`, {
      method: 'POST',
      headers: {
        'Idempotency-Key':
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `inbox-${input.conversationId}-${Date.now()}`,
      },
      body: JSON.stringify({ language: input.locale }),
    });
    const variants = (res.data?.variants ?? []).filter((item) => item.text?.trim());
    if (!variants.length) return template;
    return {
      text: variants[0]!.text,
      variants,
      source: 'ai',
      banner: reviewBanner(input.locale, res.data?.banner ?? ''),
      brandProfileVersionId: res.data?.brand_profile_version_id ?? null,
      usedApprovedProfile: Boolean(res.data?.used_approved_profile),
    };
  } catch (err) {
    if (isFallbackError(err)) return template;
    throw err;
  }
}
