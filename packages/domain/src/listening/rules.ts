export const LISTENING_KINDS = ['BRAND', 'COMPETITOR', 'TOPIC'] as const;
export type ListeningKind = (typeof LISTENING_KINDS)[number];

export const LISTENING_PLATFORM_IDS = [
  'META_FB',
  'META_IG',
  'TIKTOK',
  'LINKEDIN',
  'X',
  'WHATSAPP',
  'REDDIT',
  'WEB',
  'YOUTUBE',
] as const;
export type ListeningPlatformId = (typeof LISTENING_PLATFORM_IDS)[number];

export const LISTENING_SYNC_STATUSES = [
  'IDLE',
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
] as const;
export type ListeningSyncStatus = (typeof LISTENING_SYNC_STATUSES)[number];

const NAME_MAX = 80;
const TERM_MAX = 80;
const TERMS_MAX = 25;
const NOTE_MAX = 500;
const HASHTAG_BODY = /^[\p{L}\p{N}_]+$/u;

function hasControlChar(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 31) return true;
  }
  return false;
}

export class ListeningRuleValidationError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(field);
    this.name = 'ListeningRuleValidationError';
    this.field = field;
  }
}

export function normalizeKeyword(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text || text.length > TERM_MAX) return null;
  if (hasControlChar(text)) return null;
  return text;
}

export function normalizeHashtag(raw: string): string | null {
  const compact = raw.trim().replace(/\s+/g, '');
  if (!compact) return null;
  const body = compact.replace(/^#+/, '');
  if (!body || body.length > 60 || !HASHTAG_BODY.test(body)) return null;
  return `#${body}`;
}

function parseTermList(raw: unknown, field: 'keywords' | 'hashtags'): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > TERMS_MAX) {
    throw new ListeningRuleValidationError(field);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') throw new ListeningRuleValidationError(field);
    const normalized = field === 'hashtags' ? normalizeHashtag(item) : normalizeKeyword(item);
    if (!normalized) {
      if (item.trim()) throw new ListeningRuleValidationError(field);
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export function parseListeningPlatforms(raw: unknown, required: boolean): ListeningPlatformId[] {
  if (raw == null) {
    if (required) throw new ListeningRuleValidationError('platforms');
    return [];
  }
  if (!Array.isArray(raw) || raw.length > LISTENING_PLATFORM_IDS.length) {
    throw new ListeningRuleValidationError('platforms');
  }
  const out: ListeningPlatformId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string' || !LISTENING_PLATFORM_IDS.includes(item as ListeningPlatformId)) {
      throw new ListeningRuleValidationError('platforms');
    }
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item as ListeningPlatformId);
  }
  if (required && out.length === 0) throw new ListeningRuleValidationError('platforms');
  return out;
}

export type ListeningRuleWrite = {
  name?: string;
  kind?: ListeningKind;
  keywords?: string[];
  hashtags?: string[];
  platforms?: ListeningPlatformId[];
  isLive?: boolean;
  contextJson?: string | null;
  brandId?: string | null;
};

export function validateListeningRuleWrite(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): ListeningRuleWrite {
  const out: ListeningRuleWrite = {};
  if (body.name !== undefined || mode === 'create') {
    if (typeof body.name !== 'string') throw new ListeningRuleValidationError('name');
    const name = body.name.trim().replace(/\s+/g, ' ');
    if (!name || name.length > NAME_MAX || hasControlChar(name)) {
      throw new ListeningRuleValidationError('name');
    }
    out.name = name;
  }
  if (body.kind !== undefined || mode === 'create') {
    const kind = String(body.kind ?? '')
      .trim()
      .toUpperCase();
    if (!LISTENING_KINDS.includes(kind as ListeningKind)) {
      throw new ListeningRuleValidationError('kind');
    }
    out.kind = kind as ListeningKind;
  }
  if (body.keywords !== undefined || mode === 'create') {
    out.keywords = parseTermList(body.keywords ?? [], 'keywords');
  }
  if (body.hashtags !== undefined || mode === 'create') {
    out.hashtags = parseTermList(body.hashtags ?? [], 'hashtags');
  }
  if (body.platforms !== undefined || mode === 'create') {
    out.platforms = parseListeningPlatforms(body.platforms ?? [], true);
  }
  if (mode === 'create') {
    const keywords = out.keywords ?? [];
    const hashtags = out.hashtags ?? [];
    if (!keywords.length && !hashtags.length) throw new ListeningRuleValidationError('terms');
  }
  if (body.isLive !== undefined) {
    if (typeof body.isLive !== 'boolean') throw new ListeningRuleValidationError('isLive');
    out.isLive = body.isLive;
  }
  if (body.contextJson !== undefined) {
    if (body.contextJson === null) out.contextJson = null;
    else if (typeof body.contextJson !== 'string' || body.contextJson.length > NOTE_MAX) {
      throw new ListeningRuleValidationError('contextJson');
    } else out.contextJson = body.contextJson.trim() || null;
  }
  if (body.brandId !== undefined) {
    if (body.brandId === null || body.brandId === '') out.brandId = null;
    else if (typeof body.brandId !== 'string' || body.brandId.length > 40) {
      throw new ListeningRuleValidationError('brandId');
    } else out.brandId = body.brandId.trim();
  }
  return out;
}

export function mergedTermsAreUseful(keywords: string[], hashtags: string[]) {
  return keywords.length + hashtags.length > 0;
}

/** One provider query per term, capped, so each rule searches its own terms. */
export function listeningSearchTerms(
  keywords: readonly string[],
  hashtags: readonly string[],
  limit = 5,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...keywords, ...hashtags.map((tag) => tag.replace(/^#+/, ''))]) {
    const term = raw.trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= limit) break;
  }
  return out;
}

/** Store only short error codes. Provider messages can contain tokens. */
export function safeListeningSyncError(errors: readonly string[]): string | null {
  const codes: string[] = [];
  for (const error of errors) {
    const lower = error.toLowerCase();
    if (lower.includes('_missing') || lower.includes('not_configured')) continue;
    const head = (error.split(':')[0] ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const code = head.slice(0, 48);
    if (!code) continue;
    codes.push(code);
    if (codes.length >= 5) break;
  }
  return codes.length ? codes.join(',') : null;
}

export type ListeningSourceReadiness =
  'configured' | 'not_configured' | 'needs_account' | 'public' | 'inbox_only';

export type ListeningSourceMeta = {
  id: ListeningPlatformId;
  mode: 'connected_account' | 'public_search' | 'server_key' | 'inbox_derived';
  readiness: ListeningSourceReadiness;
  limitation: string;
};

export function buildListeningSourceCatalog(input: {
  connectedNetworks: readonly string[];
  youtubeConfigured: boolean;
  webConfigured: boolean;
}): ListeningSourceMeta[] {
  const connected = new Set(input.connectedNetworks.map((network) => network.toUpperCase()));
  const has = (network: string) => connected.has(network);
  return [
    {
      id: 'META_FB',
      mode: 'connected_account',
      readiness: has('FACEBOOK') ? 'configured' : 'needs_account',
      limitation: 'page_tags_only',
    },
    {
      id: 'META_IG',
      mode: 'connected_account',
      readiness: has('INSTAGRAM') ? 'configured' : 'needs_account',
      limitation: 'tags_and_up_to_five_hashtags',
    },
    {
      id: 'REDDIT',
      mode: 'public_search',
      readiness: 'public',
      limitation: 'public_search_up_to_five_terms',
    },
    {
      id: 'YOUTUBE',
      mode: 'server_key',
      readiness: input.youtubeConfigured ? 'configured' : 'not_configured',
      limitation: 'server_key_search_newest',
    },
    {
      id: 'WEB',
      mode: 'server_key',
      readiness: input.webConfigured ? 'configured' : 'not_configured',
      limitation: 'custom_search_last_7_days',
    },
    {
      id: 'X',
      mode: 'inbox_derived',
      readiness: has('X') ? 'inbox_only' : 'needs_account',
      limitation: 'inbox_mentions_and_dms_not_global_search',
    },
    {
      id: 'TIKTOK',
      mode: 'inbox_derived',
      readiness: has('TIKTOK') ? 'inbox_only' : 'needs_account',
      limitation: 'inbox_webhook_only',
    },
    {
      id: 'LINKEDIN',
      mode: 'inbox_derived',
      readiness: has('LINKEDIN') ? 'inbox_only' : 'needs_account',
      limitation: 'inbox_webhook_only',
    },
    {
      id: 'WHATSAPP',
      mode: 'inbox_derived',
      readiness: has('WHATSAPP') ? 'inbox_only' : 'needs_account',
      limitation: 'inbox_webhook_only',
    },
  ];
}
