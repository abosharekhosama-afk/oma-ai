/**
 * Structured-output capability per provider/model (DEC-027 #2).
 * - json_schema_strict: the provider enforces our JSON Schema.
 * - json_object: the provider only guarantees a JSON object; the schema is sent
 *   in the prompt and the output is validated with Zod (plus one repair).
 */
export type StructuredOutputMode = 'json_schema_strict' | 'json_object';

export type AiProviderName = 'openai' | 'grok' | 'groq' | 'gemini';

export type ProviderCapability = {
  provider: AiProviderName;
  /** Default mode for the provider. */
  defaultMode: StructuredOutputMode;
  /** Models that support strict json_schema when the default is json_object. */
  strictModels: readonly string[];
  note: string;
};

export const PROVIDER_CAPABILITIES: Readonly<Record<AiProviderName, ProviderCapability>> = {
  openai: {
    provider: 'openai',
    defaultMode: 'json_schema_strict',
    strictModels: [],
    note: 'Responses API text.format json_schema strict.',
  },
  grok: {
    provider: 'grok',
    defaultMode: 'json_schema_strict',
    strictModels: [],
    note: 'xAI OpenAI-compatible response_format json_schema.',
  },
  groq: {
    provider: 'groq',
    defaultMode: 'json_object',
    strictModels: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'],
    note: 'Strict json_schema only on some models; others use json_object.',
  },
  gemini: {
    provider: 'gemini',
    defaultMode: 'json_object',
    strictModels: [],
    note: 'OpenAI-compatible endpoint accepts a schema subset; json_object is the safe default.',
  },
};

export function structuredOutputMode(
  provider: AiProviderName,
  model: string,
  env: { AI_STRUCTURED_OUTPUT_MODE?: string } = process.env,
): StructuredOutputMode {
  const override = env.AI_STRUCTURED_OUTPUT_MODE?.trim().toLowerCase();
  if (override === 'json_object' || override === 'json_schema_strict') return override;
  const cap = PROVIDER_CAPABILITIES[provider];
  if (cap.defaultMode === 'json_object' && cap.strictModels.includes(model)) {
    return 'json_schema_strict';
  }
  return cap.defaultMode;
}

/** A provider 400 that rejected the response format or schema itself (not the content). */
export function isSchemaRejection(err: unknown): boolean {
  const e = err as { status?: number; message?: string; error?: { message?: string } };
  const message = `${e?.error?.message ?? ''} ${e?.message ?? ''}`;
  return e?.status === 400 && /response_format|json_schema|schema|structured output/i.test(message);
}
