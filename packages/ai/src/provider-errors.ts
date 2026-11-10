export type AiStructuredErrorCode =
  | 'AI_DISABLED'
  | 'NOT_CONFIGURED'
  | 'BILLING_NOT_ENABLED'
  | 'SCHEMA_INVALID'
  | 'AUTH'
  | 'QUOTA'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'REFUSAL'
  | 'CONTENT_FILTER'
  | 'PROVIDER_ERROR';

export function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function mapProviderError(err: unknown): {
  code: AiStructuredErrorCode;
  message: string;
  retryable: boolean;
} {
  const error = err as {
    name?: string;
    message?: string;
    status?: number;
    code?: string;
    type?: string;
    error?: { code?: string; type?: string; message?: string };
  };
  const status = error?.status;
  const code = String(error?.code || error?.error?.code || '').toLowerCase();
  const type = String(error?.type || error?.error?.type || '').toLowerCase();
  const message = error?.error?.message || error?.message || 'AI provider error';

  if (error?.name === 'AbortError' || /timeout|timed out|aborted/i.test(message)) {
    return { code: 'TIMEOUT', message: 'AI request timed out', retryable: false };
  }
  if (status === 401 || status === 403 || code === 'invalid_api_key') {
    return { code: 'AUTH', message: 'AI provider authentication failed', retryable: false };
  }
  if (code === 'insufficient_quota' || type.includes('insufficient_quota')) {
    return { code: 'QUOTA', message: 'AI provider quota exceeded', retryable: false };
  }
  if (status === 429) {
    return { code: 'RATE_LIMIT', message: 'AI provider rate limited', retryable: true };
  }
  if (code.includes('content_filter') || type.includes('content_filter')) {
    return {
      code: 'CONTENT_FILTER',
      message: 'AI provider content filter blocked the request',
      retryable: false,
    };
  }
  if (isRetryableStatus(status)) {
    return { code: 'PROVIDER_ERROR', message, retryable: true };
  }
  return { code: 'PROVIDER_ERROR', message, retryable: false };
}
