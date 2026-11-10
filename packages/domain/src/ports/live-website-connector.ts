import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, errors as undiciErrors, fetch as undiciFetch } from 'undici';
import { decodeTextBytes } from '../brand/html-charset';
import {
  defaultPortForProtocol,
  parseAllowedPorts,
  parseFetchableUrl,
  shouldFollowRedirect,
  type FetchUrlPolicy,
} from '../brand/fetch-url-policy';
import { decideRobotsPath, parseRobotsTxt, type CachedRobots } from '../brand/robots-parser';
import { checkSsrfHost, isBlockedIp, type SsrfPolicyOptions } from '../brand/ssrf-policy';
import type {
  FetchPublicInput,
  FetchPublicResult,
  RobotsDecision,
  RobotsInfo,
  ValidateSourceResult,
  WebsiteConnectorPort,
} from './website-connector.port';
import { LiveWebsiteFetchError } from './website-connector.port';
export { LiveWebsiteFetchError };

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const TEXT_TYPES = new Set(['text/plain', 'text/html', 'application/xhtml+xml']);
const XML_TYPES = new Set([
  'application/xml',
  'text/xml',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
]);

export type LiveWebsiteConnectorOptions = {
  userAgent?: string;
  acceptLanguage?: string;
  timeoutMs?: number;
  connectTimeoutMs?: number;
  maxRedirects?: number;
  perHostConcurrency?: number;
  delayMs?: number;
  maxRetries?: number;
  allowedPorts?: number[];
  allowPrivateHosts?: boolean;
  maxBytes?: number;
};

export const DEFAULT_LIVE_CONNECTOR_OPTIONS = {
  userAgent: 'OMA-BrandScanner/1.0 (+https://oma.ai)',
  acceptLanguage: 'en,ar;q=0.9',
  timeoutMs: 15_000,
  connectTimeoutMs: 5_000,
  maxRedirects: 5,
  perHostConcurrency: 1,
  delayMs: 500,
  maxRetries: 2,
  allowedPorts: [80, 443],
  allowPrivateHosts: false,
  maxBytes: 1_000_000,
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

export function isPrivateHostOverrideEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionRuntime(env)) return false;
  return (
    env.BRAND_SCANNER_ALLOW_PRIVATE_HOSTS === '1' ||
    env.BRAND_SCANNER_ALLOW_PRIVATE_HOSTS === 'true'
  );
}

function mimeFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  return contentType.split(';')[0]?.trim().toLowerCase() || null;
}

function contentTypeAllowed(
  contentType: string | null,
  accept: FetchPublicInput['accept'],
): boolean {
  const mime = mimeFromContentType(contentType);
  if (!mime) return true;
  if (accept === 'xml') return XML_TYPES.has(mime) || mime.endsWith('+xml');
  if (accept === 'text') return TEXT_TYPES.has(mime) || mime.startsWith('text/');
  return HTML_TYPES.has(mime);
}

function looksLikeHtml(body: string): boolean {
  const head = body.slice(0, 2048).toLowerCase();
  return (
    head.includes('<html') ||
    head.includes('<!doctype html') ||
    head.includes('<head') ||
    head.includes('<title')
  );
}

function classifyNetworkError(err: unknown): LiveWebsiteFetchError {
  if (err instanceof LiveWebsiteFetchError) return err;
  const anyErr = err as {
    code?: string | number;
    name?: string;
    message?: string;
    cause?: { code?: string | number };
  };
  const code = String(anyErr.code ?? anyErr.cause?.code ?? '');
  const message = anyErr.message ?? 'Request failed';
  if (
    code.startsWith('ERR_TLS') ||
    code.includes('CERT') ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    message.toLowerCase().includes('certificate') ||
    (undiciErrors.SecureProxyConnectionError &&
      err instanceof undiciErrors.SecureProxyConnectionError)
  ) {
    return new LiveWebsiteFetchError('WEBSITE_TLS_ERROR', message);
  }
  if (
    anyErr.name === 'AbortError' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT'
  ) {
    return new LiveWebsiteFetchError('WEBSITE_UNREACHABLE', message);
  }
  return new LiveWebsiteFetchError('WEBSITE_UNREACHABLE', message);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 15_000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.min(Math.max(0, date - Date.now()), 15_000);
  return null;
}

function parseHostSpec(host: string): URL | null {
  try {
    if (host.includes('://')) return new URL(host);
    return new URL(`https://${host}`);
  } catch {
    return null;
  }
}

function robotsCandidateUrls(host: string): string[] {
  const parsed = parseHostSpec(host);
  if (!parsed) return [];
  const port = parsed.port;
  if (!port || port === '443') return [`https://${parsed.host}/robots.txt`];
  if (port === '80') return [`http://${parsed.host}/robots.txt`];
  return [`http://${parsed.host}/robots.txt`, `https://${parsed.host}/robots.txt`];
}

class HostLimiter {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly lastAt = new Map<string, number>();
  private readonly inflight = new Map<string, number>();

  constructor(
    private readonly concurrency: number,
    private readonly delayMs: number,
  ) {}

  async schedule<T>(host: string, extraDelayMs: number, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(host) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(
      host,
      prev.then(() => gate).catch(() => gate),
    );
    await prev.catch(() => undefined);
    while ((this.inflight.get(host) ?? 0) >= Math.max(1, this.concurrency)) {
      await sleep(25);
    }
    const wait = Math.max(
      0,
      (this.lastAt.get(host) ?? 0) + Math.max(this.delayMs, extraDelayMs) - Date.now(),
    );
    if (wait > 0) await sleep(wait);
    this.inflight.set(host, (this.inflight.get(host) ?? 0) + 1);
    try {
      const result = await fn();
      this.lastAt.set(host, Date.now());
      return result;
    } finally {
      this.inflight.set(host, Math.max(0, (this.inflight.get(host) ?? 1) - 1));
      release();
    }
  }
}

async function resolvePublicAddresses(
  hostname: string,
  ssrf: SsrfPolicyOptions,
): Promise<Array<{ address: string; family: 4 | 6 }>> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname, ssrf)) {
      throw new LiveWebsiteFetchError('URL_SSRF_DENIED', `blocked ip ${hostname}`);
    }
    return [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }];
  }
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    throw classifyNetworkError(err);
  }
  const allowed = records
    .filter((record) => !isBlockedIp(record.address, ssrf))
    .map((record) => ({ address: record.address, family: (record.family === 6 ? 6 : 4) as 4 | 6 }));
  if (allowed.length === 0) {
    throw new LiveWebsiteFetchError('URL_SSRF_DENIED', `no public addresses for ${hostname}`);
  }
  return allowed;
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      if (signal.aborted) throw new LiveWebsiteFetchError('WEBSITE_UNREACHABLE', 'Request aborted');
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new LiveWebsiteFetchError('PAYLOAD_TOO_LARGE', `Response exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function createLiveWebsiteConnector(
  rawOptions: LiveWebsiteConnectorOptions = {},
): WebsiteConnectorPort {
  const allowPrivateHosts = Boolean(rawOptions.allowPrivateHosts) && !isProductionRuntime();
  const options = {
    userAgent: rawOptions.userAgent ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.userAgent,
    acceptLanguage: rawOptions.acceptLanguage ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.acceptLanguage,
    timeoutMs: rawOptions.timeoutMs ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.timeoutMs,
    connectTimeoutMs:
      rawOptions.connectTimeoutMs ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.connectTimeoutMs,
    maxRedirects: rawOptions.maxRedirects ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.maxRedirects,
    perHostConcurrency:
      rawOptions.perHostConcurrency ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.perHostConcurrency,
    delayMs: rawOptions.delayMs ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.delayMs,
    maxRetries: rawOptions.maxRetries ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.maxRetries,
    allowedPorts: rawOptions.allowedPorts ?? [...DEFAULT_LIVE_CONNECTOR_OPTIONS.allowedPorts],
    maxBytes: rawOptions.maxBytes ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.maxBytes,
  };
  const policy: FetchUrlPolicy = {
    allowedPorts: new Set(options.allowedPorts),
    allowAnyPort: allowPrivateHosts,
  };
  const ssrf: SsrfPolicyOptions = { allowLoopback: allowPrivateHosts };
  const limiter = new HostLimiter(options.perHostConcurrency, options.delayMs);
  const robotsCache = new Map<string, CachedRobots>();

  const requestHeaders = {
    'user-agent': options.userAgent,
    'accept-language': options.acceptLanguage,
    'accept-encoding': 'gzip, br',
  };

  async function rawFetch(url: URL, method: 'GET' | 'HEAD', maxBytes: number, timeoutMs: number) {
    const hostCheck = checkSsrfHost(url.hostname, ssrf);
    if (!hostCheck.ok) {
      throw new LiveWebsiteFetchError('URL_SSRF_DENIED', hostCheck.reason);
    }
    const addresses = await resolvePublicAddresses(url.hostname, ssrf);
    const pin = addresses[0]!;
    const dispatcher = new Agent({
      connect: {
        timeout: options.connectTimeoutMs,
        servername: net.isIP(url.hostname) ? undefined : url.hostname,
        lookup: (_hostname, _lookupOptions, callback) => {
          callback(null, pin.address, pin.family);
        },
      },
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await undiciFetch(url, {
        method,
        dispatcher,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          ...requestHeaders,
          accept:
            method === 'HEAD'
              ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
      });
      const contentType = response.headers.get('content-type');
      const location = response.headers.get('location');
      const retryAfter = response.headers.get('retry-after');
      const bytes =
        method === 'HEAD'
          ? new Uint8Array()
          : await readBoundedBody(response as unknown as Response, maxBytes, controller.signal);
      return {
        status: response.status,
        contentType,
        location,
        retryAfter,
        bytes,
      };
    } catch (err) {
      throw classifyNetworkError(err);
    } finally {
      clearTimeout(timer);
      await dispatcher.close();
    }
  }

  async function fetchFollowingRedirects(
    inputUrl: string,
    init: {
      method?: 'GET' | 'HEAD';
      maxBytes: number;
      timeoutMs: number;
      accept: FetchPublicInput['accept'];
    },
  ): Promise<FetchPublicResult> {
    const chain: string[] = [];
    let current = inputUrl;
    for (let hop = 0; hop <= options.maxRedirects; hop += 1) {
      const parsed = parseFetchableUrl(current, policy);
      if (!parsed.ok) {
        throw new LiveWebsiteFetchError(parsed.code, parsed.reason);
      }
      chain.push(parsed.url.toString());
      const host = parsed.url.hostname;
      const result = await limiter.schedule(host, 0, async () => {
        let attempt = 0;
        for (;;) {
          const fetched = await rawFetch(
            parsed.url,
            init.method ?? 'GET',
            init.maxBytes,
            init.timeoutMs,
          );
          if ((fetched.status === 429 || fetched.status === 503) && attempt < options.maxRetries) {
            const wait = parseRetryAfter(fetched.retryAfter) ?? Math.min(500 * 2 ** attempt, 8_000);
            await sleep(wait);
            attempt += 1;
            continue;
          }
          return fetched;
        }
      });

      if (result.status >= 300 && result.status < 400 && result.location) {
        const next = new URL(result.location, parsed.url).toString();
        const follow = shouldFollowRedirect(parsed.url.toString(), next);
        chain.push(next);
        if (!follow.follow) {
          return {
            url: inputUrl,
            finalUrl: parsed.url.toString(),
            status: result.status,
            contentType: result.contentType,
            body: '',
            redirectChain: chain,
          };
        }
        current = next;
        continue;
      }

      if (init.method !== 'HEAD' && !contentTypeAllowed(result.contentType, init.accept)) {
        throw new LiveWebsiteFetchError(
          'WEBSITE_NON_HTML',
          `Unexpected content type ${result.contentType ?? 'unknown'}`,
        );
      }
      const body = init.method === 'HEAD' ? '' : decodeTextBytes(result.bytes, result.contentType);
      return {
        url: inputUrl,
        finalUrl: parsed.url.toString(),
        status: result.status,
        contentType: result.contentType,
        body,
        redirectChain: chain,
      };
    }
    throw new LiveWebsiteFetchError(
      'WEBSITE_TOO_MANY_REDIRECTS',
      `Exceeded ${options.maxRedirects} redirects`,
    );
  }

  async function loadRobots(host: string): Promise<CachedRobots> {
    const key = host.toLowerCase();
    const cached = robotsCache.get(key);
    if (cached) return cached;
    const candidates = robotsCandidateUrls(host);
    let record: CachedRobots = { availability: 'missing' };
    for (const candidate of candidates) {
      try {
        const fetched = await fetchFollowingRedirects(candidate, {
          method: 'GET',
          maxBytes: Math.min(options.maxBytes, 256_000),
          timeoutMs: options.timeoutMs,
          accept: 'text',
        });
        if (fetched.status === 404 || fetched.status === 410) {
          record = { availability: 'missing' };
          break;
        }
        if (fetched.status >= 500) {
          record = { availability: 'unavailable' };
          break;
        }
        if (fetched.status >= 400) {
          record = { availability: 'missing' };
          break;
        }
        const parsed = parseRobotsTxt(fetched.body);
        parsed.sitemaps = parsed.sitemaps.map((item) => {
          try {
            return new URL(item, fetched.finalUrl).toString();
          } catch {
            return item;
          }
        });
        record = { availability: 'ok', parsed };
        break;
      } catch (err) {
        if (err instanceof LiveWebsiteFetchError && err.code === 'URL_SSRF_DENIED') throw err;
        record = { availability: 'missing' };
      }
    }
    robotsCache.set(key, record);
    return record;
  }

  return {
    async validateSource({ url }): Promise<ValidateSourceResult> {
      try {
        const parsed = parseFetchableUrl(url, policy);
        if (!parsed.ok) return { ok: false, reason: parsed.reason, code: parsed.code };
        const hostCheck = checkSsrfHost(parsed.url.hostname, ssrf);
        if (!hostCheck.ok) return { ok: false, reason: hostCheck.reason, code: 'URL_SSRF_DENIED' };
        const robots = await loadRobots(parsed.url.host);
        const path = `${parsed.url.pathname || '/'}${parsed.url.search}`;
        const decision = decideRobotsPath(robots, path, options.userAgent);
        if (decision.decision === 'DISALLOW') {
          return {
            ok: false,
            reason: 'robots.txt disallows crawling this website',
            code: 'WEBSITE_ROBOTS_DISALLOWED',
          };
        }
        let fetched: FetchPublicResult;
        try {
          fetched = await fetchFollowingRedirects(url, {
            method: 'HEAD',
            maxBytes: Math.min(options.maxBytes, 64_000),
            timeoutMs: options.timeoutMs,
            accept: 'html',
          });
        } catch (err) {
          if (err instanceof LiveWebsiteFetchError && err.code === 'WEBSITE_NON_HTML') {
            return { ok: false, reason: err.message, code: err.code };
          }
          throw err;
        }
        if (fetched.status === 405 || fetched.status === 501 || !fetched.contentType) {
          fetched = await fetchFollowingRedirects(url, {
            method: 'GET',
            maxBytes: Math.min(options.maxBytes, 256_000),
            timeoutMs: options.timeoutMs,
            accept: 'html',
          });
        }
        if (fetched.status >= 400) {
          return {
            ok: false,
            reason: `Website returned HTTP ${fetched.status}`,
            code: 'WEBSITE_UNREACHABLE',
          };
        }
        const mime = mimeFromContentType(fetched.contentType);
        if (mime && !HTML_TYPES.has(mime)) {
          return { ok: false, reason: `Expected HTML, received ${mime}`, code: 'WEBSITE_NON_HTML' };
        }
        if (!mime && fetched.body && !looksLikeHtml(fetched.body)) {
          return { ok: false, reason: 'Response is not HTML', code: 'WEBSITE_NON_HTML' };
        }
        return { ok: true };
      } catch (err) {
        const mapped = classifyNetworkError(err);
        return { ok: false, reason: mapped.message, code: mapped.code };
      }
    },
    async startIngestion() {
      // Worker orchestrates fetchPublic directly.
    },
    async getProgress() {
      return { status: 'RUNNING', percent: 50 };
    },
    async fetchPublic(input: FetchPublicInput): Promise<FetchPublicResult> {
      return fetchFollowingRedirects(input.url, {
        method: 'GET',
        maxBytes: input.maxBytes ?? options.maxBytes,
        timeoutMs: input.timeoutMs ?? options.timeoutMs,
        accept: input.accept ?? 'html',
      });
    },
    async resolveRedirectTarget(url: string): Promise<string | null> {
      const fetched = await fetchFollowingRedirects(url, {
        method: 'HEAD',
        maxBytes: 1024,
        timeoutMs: options.timeoutMs,
        accept: 'html',
      });
      if (fetched.redirectChain.length > 1) {
        return fetched.redirectChain[fetched.redirectChain.length - 1] ?? null;
      }
      return fetched.finalUrl === url ? null : fetched.finalUrl;
    },
    async evaluateRobots(host: string, path: string): Promise<RobotsDecision> {
      const cached = await loadRobots(host);
      return decideRobotsPath(cached, path || '/', options.userAgent).decision;
    },
    async inspectRobots(host: string): Promise<RobotsInfo> {
      const cached = await loadRobots(host);
      if (cached.availability !== 'ok') {
        return { sitemaps: [], crawlDelaySeconds: null, availability: cached.availability };
      }
      const evaluated = decideRobotsPath(cached, '/', options.userAgent);
      return {
        sitemaps: cached.parsed.sitemaps,
        crawlDelaySeconds: evaluated.crawlDelaySeconds,
        availability: 'ok',
      };
    },
  };
}

export function liveConnectorOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LiveWebsiteConnectorOptions {
  return {
    userAgent: env.BRAND_SCANNER_USER_AGENT || DEFAULT_LIVE_CONNECTOR_OPTIONS.userAgent,
    acceptLanguage:
      env.BRAND_SCANNER_ACCEPT_LANGUAGE || DEFAULT_LIVE_CONNECTOR_OPTIONS.acceptLanguage,
    timeoutMs: Number(env.BRAND_SCANNER_TIMEOUT_MS ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.timeoutMs),
    connectTimeoutMs: Number(
      env.BRAND_SCANNER_CONNECT_TIMEOUT_MS ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.connectTimeoutMs,
    ),
    maxRedirects: Number(
      env.BRAND_SCANNER_MAX_REDIRECTS ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.maxRedirects,
    ),
    perHostConcurrency: Number(
      env.BRAND_SCANNER_CONCURRENCY ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.perHostConcurrency,
    ),
    delayMs: Number(env.BRAND_SCANNER_DELAY_MS ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.delayMs),
    maxRetries: Number(env.BRAND_SCANNER_MAX_RETRIES ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.maxRetries),
    allowedPorts: parseAllowedPorts(env.BRAND_ALLOWED_PORTS),
    allowPrivateHosts: isPrivateHostOverrideEnabled(env),
    maxBytes: Number(env.BRAND_MAX_BYTES ?? DEFAULT_LIVE_CONNECTOR_OPTIONS.maxBytes),
  };
}

export { defaultPortForProtocol };
