import { AI_OUTPUT_CONTRACTS, parseAiOutput } from '@oma/domain';
import { isSchemaRejection, type StructuredOutputMode } from './capabilities';
import { mapProviderError, type AiStructuredErrorCode } from './provider-errors';

export type CoreMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type CoreReply = {
  text: string;
  refusal: string | null;
  inputTokens: number;
  outputTokens: number;
};

export type CoreTransport = (
  messages: CoreMessage[],
  format: { mode: StructuredOutputMode; schema: Record<string, unknown> },
  signal: AbortSignal,
) => Promise<CoreReply>;

export type AiStructuredSuccess = {
  ok: true;
  /** Output that passed the call's contract validator. */
  output: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Provider calls that returned a reply (first call + repairs). */
  attempts: number;
  mode: StructuredOutputMode;
};

export type AiStructuredFailure = {
  ok: false;
  code: AiStructuredErrorCode;
  message?: string;
  /** parse = not JSON; schema = JSON that failed the contract. */
  stage?: 'parse' | 'schema';
  /** Contract issues, when the validator reported them. */
  issues?: string[];
  /** Usage of the calls that produced this failure (they are still billed). */
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  attempts?: number;
  mode?: StructuredOutputMode;
};

export type StructuredValidate = (
  parsed: unknown,
) => { ok: true; value: unknown } | { ok: false; issues?: string[] };

/**
 * Default contract when a caller passes no schema/validator: the v2
 * `brand.analysis` contract (the v1 hand-written proposal schema is gone).
 */
export function defaultStructuredContract(): {
  schema: Record<string, unknown>;
  validate: StructuredValidate;
} {
  const contract = AI_OUTPUT_CONTRACTS['brand.analysis'];
  return {
    schema: contract.jsonSchema(),
    validate: (parsed) => {
      const r = parseAiOutput(contract.schema, parsed);
      return r.ok ? { ok: true, value: r.value } : { ok: false, issues: r.issues };
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ECHO_CHARS = 8000;

export function repairAttemptsFromEnv(env: { AI_REPAIR_ATTEMPTS?: string } = process.env): number {
  const n = Number(env.AI_REPAIR_ATTEMPTS ?? 1);
  return Number.isFinite(n) ? Math.min(2, Math.max(0, Math.floor(n))) : 1;
}

/** Strip a ```json fence some models add in json_object mode. */
export function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence ? fence[1]! : trimmed;
}

export function buildRepairMessage(issues: string[]): string {
  const lines = issues.length ? issues.slice(0, 20) : ['The reply did not match the schema.'];
  return [
    'Your previous reply was rejected by the validator:',
    ...lines.map((line) => `- ${line}`),
    'Return only the corrected JSON object. Keep every valid value, fix only what is listed, and do not add fields.',
  ].join('\n');
}

function baseMessages(
  system: string,
  user: string,
  mode: StructuredOutputMode,
  schema: Record<string, unknown>,
): CoreMessage[] {
  const sys =
    mode === 'json_object'
      ? `${system}\n\nReturn only one JSON object (no prose, no code fences) that matches this JSON Schema exactly:\n${JSON.stringify(schema)}`
      : system;
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

/**
 * Shared structured-output loop for every provider:
 * transient retries, one-time strict -> json_object fallback when the provider
 * rejects the schema, and a bounded repair round on invalid JSON or schema.
 */
export async function runStructuredCore(opts: {
  transport: CoreTransport;
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  mode: StructuredOutputMode;
  validate: StructuredValidate;
  maxRetries: number;
  timeoutMs: number;
  repairAttempts: number;
  abortSignal?: AbortSignal;
}): Promise<AiStructuredSuccess | AiStructuredFailure> {
  let mode = opts.mode;
  let fellBack = false;
  let messages = baseMessages(opts.system, opts.user, mode, opts.schema);
  let attempts = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const usage = () => ({ model: opts.model, inputTokens, outputTokens, attempts, mode });

  for (let round = 0; ; round += 1) {
    let reply: CoreReply | null = null;
    for (let retry = 0; retry <= opts.maxRetries; retry += 1) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      opts.abortSignal?.addEventListener('abort', onAbort);
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        reply = await opts.transport(messages, { mode, schema: opts.schema }, controller.signal);
        break;
      } catch (err) {
        if (mode === 'json_schema_strict' && !fellBack && isSchemaRejection(err)) {
          // DEC-027 #2: the provider rejected the schema itself; fall back once.
          fellBack = true;
          mode = 'json_object';
          messages = baseMessages(opts.system, opts.user, mode, opts.schema);
          retry -= 1;
          continue;
        }
        const mapped = mapProviderError(err);
        const canRetry = mapped.retryable && retry < opts.maxRetries && !opts.abortSignal?.aborted;
        if (!canRetry) return { ok: false, code: mapped.code, message: mapped.message, ...usage() };
        await sleep(250 * 2 ** retry);
      } finally {
        clearTimeout(timer);
        opts.abortSignal?.removeEventListener('abort', onAbort);
      }
    }
    if (!reply) return { ok: false, code: 'PROVIDER_ERROR', ...usage() };

    attempts += 1;
    inputTokens += reply.inputTokens;
    outputTokens += reply.outputTokens;
    if (reply.refusal) return { ok: false, code: 'REFUSAL', message: reply.refusal, ...usage() };

    let stage: 'parse' | 'schema';
    let issues: string[];
    let parsed: unknown;
    let parsedOk = true;
    try {
      parsed = JSON.parse(extractJsonText(reply.text || ''));
    } catch {
      parsedOk = false;
    }
    if (parsedOk) {
      const checked = opts.validate(parsed);
      if (checked.ok) return { ok: true, output: checked.value, ...usage() };
      stage = 'schema';
      issues = checked.issues ?? [];
    } else {
      stage = 'parse';
      issues = ['The reply was not valid JSON.'];
    }

    if (round >= opts.repairAttempts) {
      return { ok: false, code: 'SCHEMA_INVALID', stage, issues, ...usage() };
    }
    messages = [
      ...messages,
      { role: 'assistant', content: (reply.text || '').slice(0, MAX_ECHO_CHARS) },
      { role: 'user', content: buildRepairMessage(issues) },
    ];
  }
}
