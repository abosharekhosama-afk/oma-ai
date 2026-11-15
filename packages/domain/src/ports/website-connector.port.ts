export type FetchPublicInput = {
  url: string;
  timeoutMs?: number;
  maxBytes?: number;
  accept?: 'html' | 'text' | 'xml' | 'json' | 'script';
  /**
   * Extra request headers for public storefront APIs (e.g. tenant headers). Only `x-*`
   * names are sent; credentials and hop-by-hop headers are never forwarded.
   */
  headers?: Record<string, string>;
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

export type RobotsInfo = {
  sitemaps: string[];
  crawlDelaySeconds: number | null;
  availability: 'ok' | 'missing' | 'unavailable';
};

export type ValidateSourceResult = {
  ok: boolean;
  reason?: string;
  code?: string;
};

export interface WebsiteConnectorPort {
  validateSource(input: { url: string }): Promise<ValidateSourceResult>;
  startIngestion(runId: string): Promise<void>;
  getProgress(runId: string): Promise<{ status: string; percent: number }>;
  fetchPublic(input: FetchPublicInput): Promise<FetchPublicResult>;
  resolveRedirectTarget(url: string): Promise<string | null>;
  evaluateRobots(host: string, path: string): Promise<RobotsDecision>;
  inspectRobots(host: string): Promise<RobotsInfo>;
}

export class WebsiteConnectorNotConfiguredError extends Error {
  constructor() {
    super('Website connector is not configured (DEC-004 open)');
    this.name = 'WebsiteConnectorNotConfiguredError';
  }
}

export class LiveWebsiteFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LiveWebsiteFetchError';
  }
}
