export const SOCIAL_NETWORKS = ['facebook', 'instagram', 'linkedin', 'tiktok', 'x'] as const;
export type SocialNetworkCode = (typeof SOCIAL_NETWORKS)[number];

export function isSocialNetwork(v: unknown): v is SocialNetworkCode {
  return typeof v === 'string' && (SOCIAL_NETWORKS as readonly string[]).includes(v);
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type TokenSet = {
  accessToken: string;
  refreshToken?: string | null;
  /** Absolute expiry; null = long-lived / does not expire. */
  expiresAt?: Date | null;
  refreshExpiresAt?: Date | null;
  scopes?: string[];
};

/** One publishable destination returned after OAuth (a page, organization or profile). */
export type ConnectedAccount = {
  externalId: string;
  name: string;
  avatarUrl?: string | null;
  token: TokenSet;
  meta?: Record<string, unknown>;
};

export type PublishablePage = {
  externalId: string;
  name: string;
  accessToken: string;
  refreshToken?: string | null;
  meta: Record<string, unknown>;
};

export type PublishInput = { text: string; mediaUrl?: string | null };
export type PublishResult = { externalId: string; url: string | null };

/**
 * Errors from a network. `retryable` drives worker backoff; `reauth` means the token is no
 * longer valid and the page must be reconnected (status NEEDS_REAUTH + alert).
 */
export class SocialProviderError extends Error {
  constructor(
    message: string,
    public readonly opts: {
      retryable: boolean;
      reauth?: boolean;
      status?: number;
      providerCode?: string;
      providerMessage?: string;
      providerLogId?: string;
    } = {
      retryable: false,
    },
  ) {
    super(message);
    this.name = 'SocialProviderError';
  }
}

export interface SocialProviderAdapter {
  readonly network: SocialNetworkCode;
  /** Env var names this adapter needs; the network is only offered when all are set. */
  readonly requiredEnv: readonly string[];
  readonly usesPkce: boolean;
  isConfigured(): boolean;
  authorizeUrl(input: { state: string; redirectUri: string; codeChallenge?: string }): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<ConnectedAccount[]>;
  /** Returns a new token set, or null when the token is long-lived and needs no refresh. */
  refresh(page: PublishablePage): Promise<TokenSet | null>;
  publish(page: PublishablePage, post: PublishInput): Promise<PublishResult>;
}

export async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

/** Map an HTTP failure to a SocialProviderError (401/403 → reauth, 429/5xx → retryable). */
export function httpError(network: string, res: Response, body: Record<string, unknown>) {
  const providerError =
    body.error && typeof body.error === 'object'
      ? (body.error as { code?: unknown; message?: unknown; log_id?: unknown })
      : undefined;
  const providerCode =
    typeof providerError?.code === 'string' || typeof providerError?.code === 'number'
      ? String(providerError.code)
      : undefined;
  const providerMessage =
    (typeof providerError?.message === 'string' && providerError.message) ||
    (body.error_description as string) ||
    (body.message as string) ||
    (body.detail as string) ||
    (typeof body.error === 'string' ? body.error : '') ||
    `HTTP ${res.status}`;
  const providerLogId =
    (typeof providerError?.log_id === 'string' && providerError.log_id) ||
    (typeof body.log_id === 'string' && body.log_id) ||
    undefined;
  const reauth =
    res.status === 401 || providerCode === '190' || providerCode === 'access_token_invalid';
  const retryable = res.status === 429 || res.status >= 500;
  const detail = [
    `${network}${providerCode ? ` [${providerCode}]` : ''}: ${providerMessage}`,
    providerLogId ? `log_id=${providerLogId}` : null,
    `http_status=${res.status}`,
  ]
    .filter(Boolean)
    .join(' | ');
  return new SocialProviderError(detail, {
    retryable,
    reauth,
    status: res.status,
    providerCode,
    providerMessage,
    providerLogId,
  });
}

export function expiresIn(seconds: unknown, now = Date.now()): Date | null {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(now + n * 1000) : null;
}
