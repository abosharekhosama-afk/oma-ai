import { api } from './api';

export type ContentAiKind = 'caption' | 'alt' | 'idea';

export type ContentAiProposal = {
  text: string;
  source: 'local' | 'run';
  banner: string;
};

function isArLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith('ar');
}

/** Honest on-device proposal (DEC-016: no live provider). Review required. */
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

/** Honest on-device inbox reply draft (DEC-016: no live provider). Review required. */
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

export async function proposeContentText(input: {
  kind: ContentAiKind;
  locale: string;
  brandName?: string;
  channel?: string;
  caption?: string;
  title?: string;
  contentId?: string;
}): Promise<ContentAiProposal> {
  const text = localContentProposal(input);
  const banner = isArLocale(input.locale)
    ? 'اقتراح ذكاء اصطناعي — يحتاج مراجعة بشرية قبل النشر'
    : 'AI proposal — requires human review before publishing';
  try {
    const status = await api<{ data?: { state?: string } }>('/api/v1/ai/status');
    const state = status.data?.state;
    if (state === 'proposal_ready' && input.contentId) {
      await api('/api/v1/ai/runs', {
        method: 'POST',
        body: JSON.stringify({
          use_case: input.kind === 'alt' ? 'extraction_normalization' : 'rewrite',
          source_entity_type: 'content',
          source_entity_id: input.contentId,
          source_version: 'compose',
          idempotency_key: `content-${input.kind}-${input.contentId}-${Date.now()}`,
          evidence_refs: [text.slice(0, 180)],
        }),
      }).catch(() => null);
    }
  } catch {
    /* offline / unconfigured: keep the local proposal */
  }
  return { text, source: 'local', banner };
}
