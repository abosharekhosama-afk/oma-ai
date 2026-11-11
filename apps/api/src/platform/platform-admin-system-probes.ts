import {
  brandConnectorMode,
  contentGenerationJsonSchema,
  createWebsiteConnector,
  emptyBrandContext,
  isAiLiveEnabled,
  isAiProviderConfigured,
  resolveBrandWebsiteConnectorChoice,
  validateContentGeneration,
} from '@oma/domain';
import { buildContentGenerationPrompt, createAiAdapterFromEnv } from '@oma/ai';
import { aiStatus } from '../ai/ai.service';
import IORedis from 'ioredis';

function envFlagTrue(value: string | undefined, defaultWhenUnset: boolean): boolean {
  if (value === undefined || value === '') return defaultWhenUnset;
  return value === '1' || value === 'true';
}

export function systemIntegrationsStatus() {
  const ai = aiStatus();
  const connectorChoice = resolveBrandWebsiteConnectorChoice();
  const ignoreRobots = envFlagTrue(process.env.BRAND_SCANNER_IGNORE_ROBOTS_TXT, true);
  return {
    data: {
      ai: {
        ...ai,
        provider_configured: isAiProviderConfigured(),
        live_enabled: isAiLiveEnabled(),
      },
      website_scan: {
        connector_choice: connectorChoice,
        connector_mode: brandConnectorMode(),
        ignore_robots_txt: ignoreRobots,
        live_connector: connectorChoice === 'live',
      },
      worker_note:
        'Brand scan ingestion and post-scan AI analysis run on the worker service with the same env vars (Gemini, Redis).',
    },
  };
}

export async function probeRedis(): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return { ok: false, latency_ms: 0, error: 'REDIS_URL missing' };
  const started = Date.now();
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    lazyConnect: true,
  });
  try {
    await client.connect();
    await client.ping();
    return { ok: true, latency_ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - started,
      error: err instanceof Error ? err.message : 'redis_ping_failed',
    };
  } finally {
    client.disconnect();
  }
}

export async function probeLiveAi(): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  code?: string;
  model?: string;
  latency_ms: number;
  sample_text?: string;
}> {
  const started = Date.now();
  if (!isAiLiveEnabled()) {
    return {
      ok: false,
      skipped: true,
      reason: 'AI_LIVE_DISABLED',
      latency_ms: Date.now() - started,
    };
  }
  if (!isAiProviderConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: 'PROVIDER_NOT_CONFIGURED',
      latency_ms: Date.now() - started,
    };
  }

  const brand = emptyBrandContext({
    tenantId: 'probe',
    brandId: 'probe',
    brandName: 'OMA Admin Probe',
  });
  const prompt = buildContentGenerationPrompt({
    kind: 'idea',
    language: 'en',
    brand,
    channel: 'instagram',
    variantCount: 1,
  });

  const adapter = createAiAdapterFromEnv();
  const result = await adapter.completeStructured({
    useCase: 'content_ideas',
    payload: { probe: true },
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    schema: contentGenerationJsonSchema(),
    validate: (raw) => {
      const checked = validateContentGeneration(raw);
      return checked.ok ? { ok: true as const, value: checked.result } : { ok: false as const };
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      reason: result.message ?? result.code,
      latency_ms: Date.now() - started,
    };
  }

  const text = result.output && typeof result.output === 'object' && 'variants' in result.output
    ? (result.output as { variants?: Array<{ text?: string }> }).variants?.[0]?.text
    : undefined;

  return {
    ok: true,
    model: result.model,
    latency_ms: Date.now() - started,
    sample_text: text?.slice(0, 200),
  };
}

export async function probeWebsiteScan(input?: { url?: string }): Promise<{
  ok: boolean;
  url: string;
  latency_ms: number;
  code?: string;
  reason?: string;
  http_status?: number;
}> {
  const url = input?.url?.trim() || 'https://example.com';
  const started = Date.now();
  const choice = resolveBrandWebsiteConnectorChoice();
  if (choice !== 'live') {
    return {
      ok: false,
      url,
      latency_ms: Date.now() - started,
      code: 'CONNECTOR_NOT_LIVE',
      reason: `BRAND_WEBSITE_CONNECTOR=${choice}`,
    };
  }

  const connector = createWebsiteConnector();
  try {
    const validated = await connector.validateSource({ url });
    if (!validated.ok) {
      return {
        ok: false,
        url,
        latency_ms: Date.now() - started,
        code: validated.code,
        reason: validated.reason,
      };
    }
    const fetched = await connector.fetchPublic({
      url,
      maxBytes: 64_000,
      timeoutMs: 15_000,
      accept: 'html',
    });
    return {
      ok: fetched.status < 400,
      url: fetched.finalUrl,
      latency_ms: Date.now() - started,
      http_status: fetched.status,
      ...(fetched.status >= 400
        ? { code: 'HTTP_ERROR', reason: `HTTP ${fetched.status}` }
        : {}),
    };
  } catch (err) {
    return {
      ok: false,
      url,
      latency_ms: Date.now() - started,
      code: 'PROBE_FAILED',
      reason: err instanceof Error ? err.message : 'probe_failed',
    };
  }
}
