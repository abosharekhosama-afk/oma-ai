export interface WebsiteConnectorPort {
  validateSource(input: { url: string }): Promise<{ ok: boolean; reason?: string }>;
  startIngestion(runId: string): Promise<void>;
  getProgress(runId: string): Promise<{ status: string; percent: number }>;
}

export class WebsiteConnectorNotConfiguredError extends Error {
  constructor() {
    super('Website connector is not configured (DEC-004 open)');
    this.name = 'WebsiteConnectorNotConfiguredError';
  }
}
