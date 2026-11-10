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
  /** Injected only in tests. Production constructs the official SDK client. */
  client?: ResponsesClient;
};

export type AiStructuredSuccess = {
  ok: true;
  proposal: AiProposal;
  output: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type AiStructuredFailure = {
  ok: false;
  code: AiStructuredErrorCode;
  message?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    validate?: (parsed: unknown) => { ok: true; value: unknown } | { ok: false };
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
    const userPrompt =
      input.userPrompt ?? JSON.stringify({ useCase: input.useCase, payload: input.payload });
    const systemPrompt = input.systemPrompt ?? 'Return only JSON matching the provided schema.';
    const schema = input.schema ?? proposalJsonSchema();
    const body = {
      model: routed.model,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'oma_text_proposal',
          strict: true,
          schema,
        },
      },
    };

    let lastError: AiStructuredFailure = { ok: false, code: 'PROVIDER_ERROR' };
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      input.abortSignal?.addEventListener('abort', onAbort);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await client.responses.create(body, { signal: controller.signal });
        const refusal = extractRefusal(response);
        if (refusal) return { ok: false, code: 'REFUSAL', message: refusal };
        let parsed: unknown;
        try {
          parsed = JSON.parse(response.output_text || '');
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
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        };
      } catch (err) {
        const mapped = mapProviderError(err);
        lastError = { ok: false, code: mapped.code, message: mapped.message };
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
