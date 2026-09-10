export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT_VERSION'
  | 'IDEMPOTENCY_KEY_REUSE'
  | 'RATE_LIMITED'
  | 'CONFLICT_STATE'
  | 'TENANT_REQUIRED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'AI_NOT_CONFIGURED'
  | 'AI_UNAVAILABLE'
  | 'AI_REFUSED'
  | 'APPROVAL_INELIGIBLE'
  | 'URL_SCHEME_DENIED'
  | 'URL_SSRF_DENIED'
  | 'WEBSITE_NOT_CONNECTED'
  | 'BRAND_ARCHIVED';

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly messageKey: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function errorEnvelope(err: DomainError, correlationId: string, requestId: string) {
  return {
    error: {
      code: err.code,
      message: err.message,
      message_key: err.messageKey,
      details: err.details,
      correlation_id: correlationId,
      request_id: requestId,
    },
  };
}
