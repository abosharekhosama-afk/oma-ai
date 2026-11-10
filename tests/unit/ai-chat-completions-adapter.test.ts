import { describe, expect, it, vi } from 'vitest';
import { AI_PROPOSAL_BANNER } from '@oma/domain';
import { ChatCompletionsProviderAdapter } from '@oma/ai';
import { createAiAdapterFromEnv } from '@oma/ai';
import { envSchema } from '@oma/config';

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

describe('Chat Completions AI provider adapter', () => {
  it.each(['grok', 'groq', 'gemini'] as const)(
    'accepts schema-conforming %s output and records token usage',
    async (provider) => {
      const create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validProposal()) } }],
        usage: { prompt_tokens: 15, completion_tokens: 9 },
      });
      const adapter = new ChatCompletionsProviderAdapter({
        provider,
        liveEnabled: true,
        defaultModel: 'model-fast',
        reasoningModel: 'model-smart',
        timeoutMs: 100,
        client: { chat: { completions: { create } } },
        baseUrl:
          provider === 'grok'
            ? 'https://api.x.ai/v1'
            : provider === 'groq'
              ? 'https://api.groq.com/openai/v1'
              : 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
      const result = await adapter.completeStructured({
        useCase: 'brand_profile_synthesis',
        payload: {},
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.model).toBe('model-smart');
        expect(result.inputTokens).toBe(15);
        expect(result.outputTokens).toBe(9);
      }
      const body = create.mock.calls[0]?.[0] as {
        response_format?: { json_schema?: { strict?: boolean; schema?: unknown } };
      };
      expect(body.response_format?.json_schema?.strict).toBe(true);
      expect(body.response_format?.json_schema?.schema).toBeTruthy();
    },
  );

  it('rejects invalid model output through application validation', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ choices: [{ message: { content: '{"invalid":true}' } }] });
    const adapter = new ChatCompletionsProviderAdapter({
      provider: 'grok',
      liveEnabled: true,
      defaultModel: 'grok-fast',
      reasoningModel: 'grok-smart',
      client: { chat: { completions: { create } } },
      baseUrl: 'https://api.x.ai/v1',
    });
    await expect(adapter.completeStructured({ useCase: 'summary', payload: {} })).resolves.toEqual({
      ok: false,
      code: 'SCHEMA_INVALID',
    });
  });

  it('maps authentication failures without retrying', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('invalid API key'), { status: 401 }));
    const adapter = new ChatCompletionsProviderAdapter({
      provider: 'gemini',
      liveEnabled: true,
      defaultModel: 'gemini-fast',
      reasoningModel: 'gemini-pro',
      client: { chat: { completions: { create } } },
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
    const result = await adapter.completeStructured({ useCase: 'summary', payload: {} });
    expect(result).toMatchObject({ ok: false, code: 'AUTH' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('selects the provider key, endpoint and model defaults from environment', () => {
    const grok = createAiAdapterFromEnv({
      AI_PROVIDER: 'grok',
      AI_LIVE_ENABLED: 'true',
      XAI_API_KEY: 'xai-secret',
    });
    const groq = createAiAdapterFromEnv({
      AI_PROVIDER: 'groq',
      AI_LIVE_ENABLED: 'true',
      GROQ_API_KEY: 'groq-secret',
    });
    const gemini = createAiAdapterFromEnv({
      AI_PROVIDER: 'gemini',
      AI_LIVE_ENABLED: 'true',
      GEMINI_API_KEY: 'google-secret',
    });
    expect(grok).toBeInstanceOf(ChatCompletionsProviderAdapter);
    expect(groq).toBeInstanceOf(ChatCompletionsProviderAdapter);
    expect(gemini).toBeInstanceOf(ChatCompletionsProviderAdapter);
  });

  it.each([
    ['grok', 'XAI_API_KEY'],
    ['groq', 'GROQ_API_KEY'],
    ['gemini', 'GEMINI_API_KEY'],
  ])('requires the matching %s key for live configuration', (provider, keyName) => {
    const common = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://oma@localhost:5432/oma',
      REDIS_URL: 'redis://localhost:6379',
      AI_PROVIDER: provider,
      AI_LIVE_ENABLED: 'true',
    };
    expect(envSchema.safeParse({ ...common, [keyName]: 'provider-test-key' }).success).toBe(true);
    expect(envSchema.safeParse(common).success).toBe(false);
  });
});
