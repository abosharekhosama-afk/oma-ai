import { readFileSync, existsSync } from 'node:fs';
import type {
  FetchPublicInput,
  FetchPublicResult,
  RobotsDecision,
  WebsiteConnectorPort,
} from './website-connector.port';
import { validateRedirectTarget } from '../brand/redirect-safety';

/** Fixture paths are only used by the server-side test connector; avoid bundling Node path APIs. */
function joinPath(...parts: string[]): string {
  return parts
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/([^:]\/)\/+/g, '$1');
}

function resolveFixtureRoot(): string {
  const candidates = [
    joinPath(process.cwd(), 'tests/fixtures/websites'),
    joinPath(process.cwd(), '../../tests/fixtures/websites'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0] ?? joinPath(process.cwd(), 'tests/fixtures/websites');
}

const FIXTURE_ROOT = resolveFixtureRoot();

const HOST_TO_SITE: Record<string, string> = {
  'acme.test': 'acme',
  '127.0.0.1': 'acme',
  localhost: 'acme',
};

function mapUrlToFile(url: string): string | null {
  const parsed = new URL(url);
  const site = HOST_TO_SITE[parsed.hostname];
  if (!site) return null;
  let rel = parsed.pathname.replace(/^\//, '') || 'index.html';
  if (!rel.endsWith('.html')) {
    if (rel === '' || rel.endsWith('/')) rel = `${rel}index.html`;
    else rel = `${rel}.html`;
  }
  const file = joinPath(FIXTURE_ROOT, site, rel);
  return existsSync(file) ? file : null;
}

export function createFixtureWebsiteConnector(): WebsiteConnectorPort {
  return {
    async validateSource({ url }) {
      const file = mapUrlToFile(url);
      return file ? { ok: true } : { ok: false, reason: 'fixture not found' };
    },
    async startIngestion() {
      // Worker orchestrates fetchPublic directly.
    },
    async getProgress() {
      return { status: 'RUNNING', percent: 50 };
    },
    async fetchPublic(input: FetchPublicInput): Promise<FetchPublicResult> {
      const redirect = await this.resolveRedirectTarget(input.url);
      const targetUrl = redirect ?? input.url;
      const validation = validateRedirectTarget(targetUrl);
      if (!validation.ok) {
        throw new Error(validation.reason);
      }
      const delayMs = Number(process.env.BRAND_FIXTURE_FETCH_DELAY_MS ?? 0);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      const file = mapUrlToFile(validation.url);
      if (!file) {
        return {
          url: input.url,
          finalUrl: validation.url,
          status: 404,
          contentType: 'text/html',
          body: '<html><body>Not found</body></html>',
          redirectChain: redirect ? [input.url, validation.url] : [input.url],
        };
      }
      const body = readFileSync(file, 'utf8');
      const maxBytes = input.maxBytes ?? 1_000_000;
      const bounded = body.slice(0, maxBytes);
      return {
        url: input.url,
        finalUrl: validation.url,
        status: 200,
        contentType: 'text/html',
        body: bounded,
        redirectChain: redirect ? [input.url, validation.url] : [input.url],
      };
    },
    async resolveRedirectTarget(url: string): Promise<string | null> {
      const parsed = new URL(url);
      if (parsed.searchParams.has('redirect')) {
        return parsed.searchParams.get('redirect');
      }
      return null;
    },
    async evaluateRobots(_host: string, path: string): Promise<RobotsDecision> {
      if (path.includes('/private')) return 'DISALLOW';
      return 'ALLOW';
    },
  };
}
