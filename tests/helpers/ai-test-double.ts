import type { AiGenerateRequest, AiGenerateResult, AiProviderPort } from '@oma/domain';

/** Test-only in-memory AiProviderPort stub (T103); never wired in production runtime. */
export class InMemoryAiTestDouble implements AiProviderPort {
  readonly calls: AiGenerateRequest[] = [];

  constructor(private readonly response: Partial<AiGenerateResult> = {}) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    this.calls.push(request);
    return {
      outputRef: `test-output:${request.purpose}`,
      providerCode: 'test-double',
      modelCode: 'stub-v1',
      confidence: 0.85,
      unknowns: [],
      ...this.response,
    };
  }
}

export function createAiTestDouble(response?: Partial<AiGenerateResult>): InMemoryAiTestDouble {
  return new InMemoryAiTestDouble(response);
}
