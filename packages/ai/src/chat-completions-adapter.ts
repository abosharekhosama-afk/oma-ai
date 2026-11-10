import {
  AiProviderNotConfiguredError,
  isAiUseCase,
  proposalJsonSchema,
  routeModel,
  validateProposal,
  type AiGenerateRequest,
  type AiGenerateResult,
  type AiModelConfig,
  type AiProposal,
  type AiProviderPort,
  type AiUseCase,
} from '@oma/domain';
import { mapProviderError, type AiStructuredErrorCode } from './provider-errors';
import type { AiStructuredFailure, AiStructuredSuccess } from './openai-adapter';

export type ChatCompletionsClient = {
  chat: {
    completions: {
      create: (
        body: Record<string, unknown>,
        options?: { signal?: AbortSignal },
      ) => Promise<{
        choices?: Array<{
          message?: { content?: string | null; refusal?: string | null };
          finish_reason?: string | null;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }>;
    };
  };
};

export type ChatCompletionsAdapterOptions = AiModelConfig & {
  provider: 'grok' | 'groq' | 'gemini';
  liveEnabled: boolean;
  apiKey?: string;
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  client?: ChatCompletionsClient;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ChatCompletionsProviderAdapter implements AiProviderPort {
  constructor(private readonly options: ChatCompletionsAdapterOptions) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    if (!this.options.liveEnabled) throw new AiProviderNotConfiguredError();
    const useCase: AiUseCase = isAiUseCase(request.purpose) ? request.purpose : 'summary';
    const result = await this.completeStructured({
      useCase,
      payload: { refs: request.inputSnapshotRefs },
      systemPrompt:
        'You are OMA text intelligence. Return a structured proposal that requires human review.',
      userPrompt: request.prompt,
    });
    if (!result.ok) {
      const error = new Error(result.message || result.code);
      error.name = result.code;
      throw error;
    }
    return {
      outputRef: `proposal:${useCase}`,
      providerCode: this.options.provider,
      modelCode: result.model,
      confidence: result.proposal.items[0]?.confidence,
      unknowns: result.proposal.items.filter((item) => !item.value).map((item) => item.field),
    };
  }

  async completeStructured(input: {
    useCase: AiUseCase;
    payload: unknown;
    systemPrompt?: string;
    userPrompt?: string;
    schema?: Record<string, unknown>;
    abortSignal?: AbortSignal;
    validate?: (parsed: unknown) => { ok: true; value: unknown } | { ok: false };
  }): Promise<AiStructuredSuccess | AiStructuredFailure> {
    const routed = routeModel(input.useCase, this.options);
    if (!this.options.liveEnabled) return { ok: false, code: 'AI_DISABLED' };

    let client = this.options.client;
    if (!client) {
      if (!this.options.apiKey) return { ok: false, code: 'NOT_CONFIGURED' };
      const OpenAI = (await import('openai')).default;
      client = new OpenAI({
        apiKey: this.options.apiKey,
        baseURL: this.options.baseUrl,
        timeout: this.options.timeoutMs ?? 60_000,
        maxRetries: 0,
      }) as unknown as ChatCompletionsClient;
    }

    const maxRetries = this.options.maxRetries ?? 2;
    const timeoutMs = this.options.timeoutMs ?? 60_000;
    const userPrompt =
      input.userPrompt ?? JSON.stringify({ useCase: input.useCase, payload: input.payload });
    const schema = input.schema ?? proposalJsonSchema();
    const body = {
      model: routed.model,
      messages: [
        {
          role: 'system',
          content: input.systemPrompt ?? 'Return only JSON matching the provided schema.',
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'oma_text_proposal', strict: true, schema },
      },
    };

    let lastError: AiStructuredFailure = { ok: false, code: 'PROVIDER_ERROR' };
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      input.abortSignal?.addEventListener('abort', onAbort);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await client.chat.completions.create(body, { signal: controller.signal });
        const choice = response.choices?.[0];
        if (choice?.message?.refusal) {
          return { ok: false, code: 'REFUSAL', message: choice.message.refusal };
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(choice?.message?.content || '');
        } catch {
          return { ok: false, code: 'SCHEMA_INVALID' };
        }
        let output: unknown = parsed;
        let proposal: AiProposal | null = null;
        if (input.validate) {
          const checked = input.validate(parsed);
          if (!checked.ok) return { ok: false, code: 'SCHEMA_INVALID' };
          output = checked.value;
        } else {
          const checked = validateProposal(parsed);
          if (!checked.ok) return { ok: false, code: 'SCHEMA_INVALID' };
          proposal = checked.proposal;
          output = checked.proposal;
        }
        return {
          ok: true,
          proposal: proposal ?? (output as AiProposal),
          output,
          model: routed.model,
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        };
      } catch (err) {
        const mapped = mapProviderError(err);
        lastError = {
          ok: false,
          code: mapped.code as AiStructuredErrorCode,
          message: mapped.message,
        };
        const canRetry = mapped.retryable && attempt < maxRetries && !input.abortSignal?.aborted;
        if (!canRetry) return lastError;
        await sleep(250 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
        input.abortSignal?.removeEventListener('abort', onAbort);
      }
    }
    return lastError;
  }
}
