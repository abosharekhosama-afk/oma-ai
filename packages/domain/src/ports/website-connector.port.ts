export type FetchPublicInput = {
  url: string;
  timeoutMs?: number;
  maxBytes?: number;
};

export type FetchPublicResult = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string | null;
  body: string;
  redirectChain: string[];
};

export type RobotsDecision = 'ALLOW' | 'DISALLOW' | 'UNKNOWN';

export interface WebsiteConnectorPort {
  validateSource(input: { url: string }): Promise<{ ok: boolean; reason?: string }>;
  startIngestion(runId: string): Promise<void>;
  getProgress(runId: string): Promise<{ status: string; percent: number }>;
  fetchPublic(input: FetchPublicInput): Promise<FetchPublicResult>;
  resolveRedirectTarget(url: string): Promise<string | null>;
  evaluateRobots(host: string, path: string): Promise<RobotsDecision>;
}

export class WebsiteConnectorNotConfiguredError extends Error {
  constructor() {
    super('Website connector is not configured (DEC-004 open)');
    this.name = 'WebsiteConnectorNotConfiguredError';
  }
}
