import { describe, expect, it, vi } from 'vitest';
import { AI_PROPOSAL_BANNER } from '@oma/domain';
import { OpenAiProviderAdapter } from '@oma/ai';

function validProposal() {
  return {
    promptId: 'oma.brand_profile_synthesis',
    promptVersion: '2',
    schemaVersion: '1',
    language: 'en',
    sourceVersion: 'v1',
    evidenceRefs: ['e1'],
    items: [
      {
        field: 'brand.description',
        value: 'A studio',
        kind: 'fact',
        confidence: 0.8,
        evidenceRefs: ['e1'],
      },
    ],
    banner: AI_PROPOSAL_BANNER,
  };
}

function adapter(create: ReturnType<typeof vi.fn>, extras: Record<string, unknown> = {}) {
  return new OpenAiProviderAdapter({
    liveEnabled: true,
    defaultModel: 'gpt-4.1-mini',
    reasoningModel: 'gpt-4.1',
    maxRetries: 2,
    timeoutMs: 50,
    client: { responses: { create } },
    ...extras,
  });
}

describe('live OpenAI adapter', () => {
  it('parses structured output and records token usage', async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify(validProposal()),
      usage: { input_tokens: 11, output_tokens: 7 },
    });
    const result = await adapter(create).completeStructured({
      useCase: 'brand_profile_synthesis',
      payload: {},
      systemPrompt: 'sys',
      userPrompt: 'user',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model).toBe('gpt-4.1');
      expect(result.inputTokens).toBe(11);
      expect(result.outputTokens).toBe(7);
      expect(result.proposal.items[0]?.field).toBe('brand.description');
    }
    expect(create).toHaveBeenCalledTimes(1);
    const body = create.mock.calls[0]?.[0] as { text?: { format?: { schema?: unknown } } };
    expect(body.text?.format?.schema).toBeTruthy();
  });

  it('rejects schema-invalid output', async () => {
    const create = vi.fn().mockResolvedValue({ output_text: '{"nope":true}' });
    const result = await adapter(create).completeStructured({
      useCase: 'summary',
      payload: {},
    });
    expect(result).toEqual({ ok: false, code: 'SCHEMA_INVALID' });
  });

  it('maps model refusals', async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: '',
      output: [{ type: 'refusal', refusal: 'I cannot help with that' }],
    });
    const result = await adapter(create).completeStructured({
      useCase: 'summary',
      payload: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('REFUSAL');
  });

  it('retries retryable 429 errors then succeeds', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('slow down'), { status: 429 }))
      .mockResolvedValueOnce({
        output_text: JSON.stringify(validProposal()),
        usage: { input_tokens: 2, output_tokens: 2 },
      });
    const result = await adapter(create).completeStructured({
      useCase: 'brand_profile_synthesis',
      payload: {},
    });
    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('maps timeouts', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const result = await adapter(create).completeStructured({
      useCase: 'summary',
      payload: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TIMEOUT');
  });

  it('maps authentication errors without retrying', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('nope'), { status: 401, code: 'invalid_api_key' }),
      );
    const result = await adapter(create).completeStructured({
      useCase: 'summary',
      payload: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('AUTH');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
