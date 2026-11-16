import { describe, expect, it, vi } from 'vitest';
import {
  PROVIDER_CAPABILITIES,
  buildRepairMessage,
  extractJsonText,
  isSchemaRejection,
  repairAttemptsFromEnv,
  runStructuredCore,
  structuredOutputMode,
  type CoreReply,
  type CoreTransport,
} from '@oma/ai';

const schema = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] };
const validate = (raw: unknown) =>
  raw && typeof raw === 'object' && typeof (raw as { a?: unknown }).a === 'string'
    ? { ok: true as const, value: raw }
    : { ok: false as const, issues: ['a: expected string'] };

function reply(text: string, extra: Partial<CoreReply> = {}): CoreReply {
  return { text, refusal: null, inputTokens: 10, outputTokens: 5, ...extra };
}

function run(
  transport: CoreTransport,
  over: Partial<Parameters<typeof runStructuredCore>[0]> = {},
) {
  return runStructuredCore({
    transport,
    model: 'm',
    system: 'sys',
    user: 'usr',
    schema,
    mode: 'json_schema_strict',
    validate,
    maxRetries: 0,
    timeoutMs: 1000,
    repairAttempts: 1,
    ...over,
  });
}

describe('structured output core: repair loop', () => {
  it('repairs invalid JSON once and sums usage', async () => {
    const transport = vi
      .fn<CoreTransport>()
      .mockResolvedValueOnce(reply('not json'))
      .mockResolvedValueOnce(reply('{"a":"ok"}'));
    const r = await run(transport);
    expect(r).toMatchObject({ ok: true, attempts: 2, inputTokens: 20, outputTokens: 10 });
    const second = transport.mock.calls[1]![0];
    expect(second.at(-2)).toEqual({ role: 'assistant', content: 'not json' });
    expect(second.at(-1)!.content).toContain('not valid JSON');
  });

  it('feeds schema issues back to the model', async () => {
    const transport = vi
      .fn<CoreTransport>()
      .mockResolvedValueOnce(reply('{"a":1}'))
      .mockResolvedValueOnce(reply('{"a":"fixed"}'));
    const r = await run(transport);
    expect(r.ok).toBe(true);
    expect(transport.mock.calls[1]![0].at(-1)!.content).toContain('a: expected string');
  });

  it('gives up after the repair budget with stage and issues', async () => {
    const transport = vi.fn<CoreTransport>().mockResolvedValue(reply('{"a":1}'));
    const r = await run(transport);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({
      ok: false,
      code: 'SCHEMA_INVALID',
      stage: 'schema',
      issues: ['a: expected string'],
      attempts: 2,
      inputTokens: 20,
    });
  });

  it('does not repair when repairAttempts is 0', async () => {
    const transport = vi.fn<CoreTransport>().mockResolvedValue(reply('x'));
    const r = await run(transport, { repairAttempts: 0 });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: false, stage: 'parse', attempts: 1 });
  });

  it('never repairs a refusal', async () => {
    const transport = vi.fn<CoreTransport>().mockResolvedValue(reply('', { refusal: 'no' }));
    const r = await run(transport);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: false, code: 'REFUSAL', message: 'no', attempts: 1 });
  });

  it('strips a code fence in json_object mode', async () => {
    const transport = vi.fn<CoreTransport>().mockResolvedValue(reply('```json\n{"a":"x"}\n```'));
    const r = await run(transport, { mode: 'json_object' });
    expect(r).toMatchObject({ ok: true, attempts: 1, mode: 'json_object' });
    const [messages, format] = transport.mock.calls[0]!;
    expect(format.mode).toBe('json_object');
    expect(messages[0]!.content).toContain('JSON Schema');
  });
});

describe('structured output core: provider capability fallback', () => {
  it('falls back to json_object once when the provider rejects the schema', async () => {
    const rejection = Object.assign(new Error('Invalid schema for response_format'), {
      status: 400,
    });
    const transport = vi
      .fn<CoreTransport>()
      .mockRejectedValueOnce(rejection)
      .mockResolvedValueOnce(reply('{"a":"ok"}'));
    const r = await run(transport);
    expect(r).toMatchObject({ ok: true, mode: 'json_object', attempts: 1 });
    expect(transport.mock.calls[1]![1].mode).toBe('json_object');
  });

  it('does not treat other 400s as schema rejections', () => {
    expect(isSchemaRejection({ status: 400, message: 'max_tokens too large' })).toBe(false);
    expect(isSchemaRejection({ status: 500, message: 'schema' })).toBe(false);
    expect(
      isSchemaRejection({ status: 400, error: { message: 'json_schema not supported' } }),
    ).toBe(true);
  });

  it('maps providers and models to a structured output mode', () => {
    expect(structuredOutputMode('openai', 'gpt-4.1', {})).toBe('json_schema_strict');
    expect(structuredOutputMode('grok', 'grok-4.7', {})).toBe('json_schema_strict');
    expect(structuredOutputMode('groq', 'openai/gpt-oss-120b', {})).toBe('json_schema_strict');
    expect(structuredOutputMode('groq', 'llama-3.3-70b-versatile', {})).toBe('json_object');
    expect(structuredOutputMode('gemini', 'gemini-3.8-flash', {})).toBe('json_object');
    expect(
      structuredOutputMode('gemini', 'x', { AI_STRUCTURED_OUTPUT_MODE: 'json_schema_strict' }),
    ).toBe('json_schema_strict');
    expect(Object.keys(PROVIDER_CAPABILITIES).sort()).toEqual(['gemini', 'grok', 'groq', 'openai']);
  });

  it('helpers', () => {
    expect(repairAttemptsFromEnv({})).toBe(1);
    expect(repairAttemptsFromEnv({ AI_REPAIR_ATTEMPTS: '0' })).toBe(0);
    expect(repairAttemptsFromEnv({ AI_REPAIR_ATTEMPTS: '9' })).toBe(2);
    expect(extractJsonText(' {"a":1} ')).toBe('{"a":1}');
    expect(buildRepairMessage(['x: bad'])).toContain('- x: bad');
  });
});
