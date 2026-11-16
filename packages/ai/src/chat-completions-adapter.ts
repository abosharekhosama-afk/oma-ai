import {
  AiProviderNotConfiguredError,
  isAiUseCase,
  type BrandAnalysisV2,
  routeModel,
  type AiGenerateRequest,
  type AiGenerateResult,
  type AiModelConfig,
  type AiProviderPort,
  type AiUseCase,
} from '@oma/domain';
import { structuredOutputMode } from './capabilities';
import {
  defaultStructuredContract,
  repairAttemptsFromEnv,
  runStructuredCore,
  type AiStructuredFailure,
  type AiStructuredSuccess,
  type CoreTransport,
  type StructuredValidate,
} from './structured-core';

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
  repairAttempts?: number;
  client?: ChatCompletionsClient;
};

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
      confidence: (result.output as BrandAnalysisV2).items[0]?.confidence,
      unknowns: (result.output as BrandAnalysisV2).items
        .filter((item) => !item.value)
        .map((item) => item.field),
    };
  }

  async completeStructured(input: {
    useCase: AiUseCase;
    payload: unknown;
    systemPrompt?: string;
    userPrompt?: string;
    schema?: Record<string, unknown>;
    abortSignal?: AbortSignal;
    validate?: StructuredValidate;
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
    const chat = client;
    const transport: CoreTransport = async (messages, format, signal) => {
      const response = await chat.chat.completions.create(
        {
          model: routed.model,
          messages,
          response_format:
            format.mode === 'json_schema_strict'
              ? {
                  type: 'json_schema',
                  json_schema: { name: 'oma_text_proposal', strict: true, schema: format.schema },
                }
              : { type: 'json_object' },
        },
        { signal },
      );
      const choice = response.choices?.[0];
      return {
        text: choice?.message?.content || '',
        refusal: choice?.message?.refusal || null,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      };
    };
    const fallback = defaultStructuredContract();
    return runStructuredCore({
      transport,
      model: routed.model,
      system: input.systemPrompt ?? 'Return only JSON matching the provided schema.',
      user: input.userPrompt ?? JSON.stringify({ useCase: input.useCase, payload: input.payload }),
      schema: input.schema ?? fallback.schema,
      mode: structuredOutputMode(this.options.provider, routed.model),
      validate: input.validate ?? fallback.validate,
      maxRetries,
      timeoutMs,
      repairAttempts: this.options.repairAttempts ?? repairAttemptsFromEnv(),
      abortSignal: input.abortSignal,
    });
  }
}
