/** Shared, locale-aware formatting for the brand intelligence surfaces. */

export function formatBrandDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Localized label for a provider error code, or null when no friendly copy exists. */
export function errorCodeLabel(
  t: (key: string) => string,
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  for (const key of [`errors.${code.toLowerCase()}`, `brand.errorCode.${code}`]) {
    const value = t(key);
    if (value && value !== key) return value;
  }
  return null;
}

/** Display name for the configured text-AI provider (proper nouns, same in every locale). */
export function aiProviderName(provider: string | null | undefined): string | null {
  switch ((provider ?? '').toLowerCase()) {
    case 'openai':
      return 'OpenAI';
    case 'gemini':
      return 'Google Gemini';
    case 'grok':
      return 'xAI Grok';
    case 'groq':
      return 'Groq';
    default:
      return null;
  }
}
