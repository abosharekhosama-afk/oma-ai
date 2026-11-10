import { DomainError } from '@oma/domain';

export function throwForStructuredCode(code: string, message?: string): never {
  if (code === 'AI_DISABLED') {
    throw new DomainError(
      'AI_DISABLED',
      'AI text intelligence is offline. Continue manually.',
      503,
      'errors.ai_disabled',
      [{ code, manual_journey: true }],
    );
  }
  if (code === 'NOT_CONFIGURED') {
    throw new DomainError(
      'AI_NOT_CONFIGURED',
      'AI is not configured. Continue manually.',
      503,
      'errors.ai_not_configured',
      [{ code, manual_journey: true }],
    );
  }
  if (code === 'AUTH' || code === 'QUOTA' || code === 'TIMEOUT' || code === 'RATE_LIMIT') {
    throw new DomainError(
      'AI_UNAVAILABLE',
      message || 'The AI provider is temporarily unavailable.',
      503,
      'errors.ai_unavailable',
      [{ code, manual_journey: true }],
    );
  }
  if (code === 'REFUSAL' || code === 'CONTENT_FILTER' || code === 'BANNED_CLAIM') {
    throw new DomainError(
      'AI_REFUSED',
      message || 'The model refused this request.',
      422,
      'errors.ai_refused',
      [{ code, manual_journey: true }],
    );
  }
  if (code === 'SCHEMA_INVALID') {
    throw new DomainError(
      'SCHEMA_INVALID',
      'Model output failed schema validation',
      422,
      'errors.schema_invalid',
    );
  }
  if (code === 'BILLING_NOT_ENABLED') {
    throw new DomainError(
      'BILLING_NOT_ENABLED',
      'Live AI billing is not activated. Continue manually.',
      503,
      'errors.billing_not_enabled',
      [{ manual_journey: true }],
    );
  }
  throw new DomainError(
    'AI_UNAVAILABLE',
    message || 'AI request failed. Continue manually.',
    503,
    'errors.ai_unavailable',
    [{ code, manual_journey: true }],
  );
}
