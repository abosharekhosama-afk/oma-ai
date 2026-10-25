/**
 * Production brief gate for Request → Task.
 *
 * READY requires non-empty objective, audience, and key message
 * (the core fields called out for stage4 brief readiness).
 * Channels, CTA, and acceptance stay on the editor for completeness
 * but do not block convert-to-task.
 */

export const REQUEST_BRIEF_MARKER = '__OMA_BRIEF_V1__';

export type BriefCoreFields = {
  objective?: string | null;
  audience?: string | null;
  keyMessage?: string | null;
};

export function briefReadiness(fields: BriefCoreFields): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!fields.objective?.trim()) missing.push('objective');
  if (!fields.audience?.trim()) missing.push('audience');
  if (!fields.keyMessage?.trim()) missing.push('key_message');
  return { ready: missing.length === 0, missing };
}

export function briefFieldsFromDescription(
  description: string | null | undefined,
): BriefCoreFields | null {
  const text = description ?? '';
  const idx = text.indexOf(REQUEST_BRIEF_MARKER);
  if (idx < 0) return null;
  try {
    const payload = JSON.parse(text.slice(idx + REQUEST_BRIEF_MARKER.length)) as {
      objective?: { en?: string } | string;
      audience?: { en?: string } | string;
      keyMessage?: { en?: string } | string;
    };
    const read = (value: { en?: string } | string | undefined) =>
      typeof value === 'string' ? value : (value?.en ?? '');
    return {
      objective: read(payload.objective),
      audience: read(payload.audience),
      keyMessage: read(payload.keyMessage),
    };
  } catch {
    return null;
  }
}
