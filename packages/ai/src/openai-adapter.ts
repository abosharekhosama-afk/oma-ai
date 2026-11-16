import {
  AiProviderNotConfiguredError,
  isAiUseCase,
  proposalJsonSchema,
  routeModel,
  type AiGenerateRequest,
  type AiGenerateResult,
  type AiModelConfig,
  type AiProviderPort,
  type AiUseCase,
} from '@oma/domain';
import { structuredOutputMode } from './capabilities';
import {
  repairAttemptsFromEnv,
  runStructuredCore,
  type AiStructuredFailure,
  type AiStructuredSuccess,
  type CoreTransport,
  type StructuredValidate,
} from './structured-core';

export type ResponsesClient = {
  responses: {
    create: (
      body: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ) => Promise<{
      output_text?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
      output?: Array<{
        type?: string;
        refusal?: string;
        content?: Array<{ type?: string; refusal?: string }>;
      }>;
    }>;
  };
};

export type OpenAiAdapterOptions = AiModelConfig & {
  liveEnabled: boolean;
  apiKey?: string;
  projectId?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Repair rounds on invalid JSON/schema (default AI_REPAIR_ATTEMPTS or 1). */
  repairAttempts?: number;
  /** Injected only in tests. Production constructs the official SDK client. */
  client?: ResponsesClient;
};

export type { AiStructuredFailure, AiStructuredSuccess };

function extractRefusal(response: {
  output?: Array<{
    type?: string;
    refusal?: string;
    content?: Array<{ type?: string; refusal?: string }>;
  }>;
}): string | null {
  for (const item of response.output ?? []) {
    if (item.type === 'refusal' && item.refusal) return item.refusal;
    for (const content of item.content ?? []) {
      if (content.type === 'refusal' && content.refusal) return content.refusal;
    }
  }
  return null;
}

/**
 * First text adapter behind AiProviderPort.
 * Live calls run only when liveEnabled is true and a client or API key is present.
 */
export class OpenAiProviderAdapter implements AiProviderPort {
  constructor(private readonly options: OpenAiAdapterOptions) {}

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
      providerCode: 'openai',
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
    validate?: StructuredValidate;
  }): Promise<AiStructuredSuccess | AiStructuredFailure> {
    const routed = routeModel(input.useCase, this.options);
    if (!this.options.liveEnabled) return { ok: false, code: 'AI_DISABLED' };

    let client = this.options.client;
    if (!client) {
      const apiKey = this.options.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) return { ok: false, code: 'NOT_CONFIGURED' };
      const OpenAI = (await import('openai')).default;
      client = new OpenAI({
        apiKey,
        project: this.options.projectId || process.env.OPENAI_PROJECT_ID || undefined,
        baseURL: this.options.baseUrl || process.env.OPENAI_BASE_URL || undefined,
        timeout: this.options.timeoutMs ?? Number(process.env.AI_REQUEST_TIMEOUT_MS || 60_000),
        maxRetries: 0,
      }) as unknown as ResponsesClient;
    }

    const maxRetries = this.options.maxRetries ?? Number(process.env.AI_MAX_RETRIES || 2);
    const timeoutMs = this.options.timeoutMs ?? Number(process.env.AI_REQUEST_TIMEOUT_MS || 60_000);
    const responses = client;
    const transport: CoreTransport = async (messages, format, signal) => {
      const response = await responses.responses.create(
        {
          model: routed.model,
          input: messages,
          text: {
            format:
              format.mode === 'json_schema_strict'
                ? {
                    type: 'json_schema',
                    name: 'oma_text_proposal',
                    strict: true,
                    schema: format.schema,
                  }
                : { type: 'json_object' },
          },
        },
        { signal },
      );
      return {
        text: response.output_text || '',
        refusal: extractRefusal(response),
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      };
    };
    return runStructuredCore({
      transport,
      model: routed.model,
      system: input.systemPrompt ?? 'Return only JSON matching the provided schema.',
      user: input.userPrompt ?? JSON.stringify({ useCase: input.useCase, payload: input.payload }),
      schema: input.schema ?? proposalJsonSchema(),
      mode: structuredOutputMode('openai', routed.model),
      validate: input.validate,
      maxRetries,
      timeoutMs,
      repairAttempts: this.options.repairAttempts ?? repairAttemptsFromEnv(),
      abortSignal: input.abortSignal,
    });
  }
}

export function selectAiProvider(options: OpenAiAdapterOptions): AiProviderPort {
  if (!options.liveEnabled) {
    return {
      async generate() {
        throw new AiProviderNotConfiguredError();
      },
    };
  }
  return new OpenAiProviderAdapter(options);
}

export function createOpenAiAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<OpenAiAdapterOptions> = {},
): OpenAiProviderAdapter {
  return new OpenAiProviderAdapter({
    liveEnabled: env.AI_LIVE_ENABLED === 'true' && Boolean(env.OPENAI_API_KEY?.trim()),
    defaultModel: env.AI_DEFAULT_MODEL?.trim() || 'gpt-4.1-mini',
    reasoningModel: env.AI_REASONING_MODEL?.trim() || 'gpt-4.1',
    apiKey: env.OPENAI_API_KEY,
    projectId: env.OPENAI_PROJECT_ID,
    baseUrl: env.OPENAI_BASE_URL,
    timeoutMs: env.AI_REQUEST_TIMEOUT_MS ? Number(env.AI_REQUEST_TIMEOUT_MS) : 60_000,
    maxRetries: env.AI_MAX_RETRIES ? Number(env.AI_MAX_RETRIES) : 2,
    ...overrides,
  });
}
