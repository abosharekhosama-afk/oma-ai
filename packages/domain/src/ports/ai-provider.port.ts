export interface AiGenerateRequest {
  tenantId: string;
  purpose: string;
  inputSnapshotRefs: string[];
  prompt: string;
}

export interface AiGenerateResult {
  outputRef: string;
  providerCode: string;
  modelCode?: string;
  confidence?: number;
  unknowns: string[];
}

export interface AiProviderPort {
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
}

export class AiProviderNotConfiguredError extends Error {
  constructor() {
    super('AI provider is not configured (DEC-007 open)');
    this.name = 'AiProviderNotConfiguredError';
  }
}
