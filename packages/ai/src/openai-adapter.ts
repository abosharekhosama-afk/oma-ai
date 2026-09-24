import {
  AiProviderNotConfiguredError,
  routeModel,
  validateProposal,
  type AiGenerateRequest,
  type AiGenerateResult,
  type AiModelConfig,
  type AiProposal,
  type AiProviderPort,
  type AiUseCase,
} from '@oma/domain';

export type ResponsesClient = {
  responses: {
    create: (body: Record<string, unknown>) => Promise<{
      output_text?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
};

export type OpenAiAdapterOptions = AiModelConfig & {
  liveEnabled: boolean;
  /** Injected only in tests. Production live calls stay behind AI_LIVE_ENABLED. */
  client?: ResponsesClient;
};

/**
 * First text adapter behind AiProviderPort.
 * When live is off, no SDK call is made. Models stay CONFIGURED_NOT_LIVE_VERIFIED.
 */
export class OpenAiProviderAdapter implements AiProviderPort {
  constructor(private readonly options: OpenAiAdapterOptions) {}

  async generate(_request: AiGenerateRequest): Promise<AiGenerateResult> {
    if (!this.options.liveEnabled) throw new AiProviderNotConfiguredError();
    const error = new Error('BILLING_NOT_ENABLED');
    error.name = 'BILLING_NOT_ENABLED';
    throw error;
  }

  async completeStructured(input: { useCase: AiUseCase; payload: unknown }): Promise<
    | {
        ok: false;
        code: 'AI_DISABLED' | 'BILLING_NOT_ENABLED' | 'SCHEMA_INVALID' | 'MODEL_NOT_VERIFIED';
      }
    | { ok: true; proposal: AiProposal; model: string; inputTokens: number; outputTokens: number }
  > {
    const routed = routeModel(input.useCase, this.options);
    if (!this.options.liveEnabled) return { ok: false, code: 'AI_DISABLED' };
    if (!this.options.client) {
      await import('openai');
      return { ok: false, code: 'BILLING_NOT_ENABLED' };
    }
    const started = Date.now();
    const response = await this.options.client.responses.create({
      model: routed.model,
      input: JSON.stringify({ useCase: input.useCase }),
      text: { format: { type: 'json_schema', name: 'oma_text_proposal', strict: true } },
    });
    void started;
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text || '');
    } catch {
      return { ok: false, code: 'SCHEMA_INVALID' };
    }
    const checked = validateProposal(parsed);
    if (!checked.ok) return { ok: false, code: 'SCHEMA_INVALID' };
    return {
      ok: true,
      proposal: checked.proposal,
      model: routed.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
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
