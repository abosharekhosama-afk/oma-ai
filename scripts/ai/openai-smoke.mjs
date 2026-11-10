#!/usr/bin/env node
/**
 * Live OpenAI smoke. Refuses in CI and without an explicit billing confirmation.
 * Never prints prompts, responses, API keys, or other secrets.
 */
const ci = process.env.CI === 'true' || process.env.CI === '1';
const live = process.env.AI_LIVE_ENABLED === 'true';
const key = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
const confirm = process.env.AI_SMOKE_CONFIRM === 'I_UNDERSTAND_BILLING';

if (ci || !live || !key || !confirm) {
  console.error('OPENAI_LIVE_ACCESS: NOT_VERIFIED');
  console.error(
    'Refusing smoke: CI, AI_LIVE_ENABLED, OPENAI_API_KEY, or AI_SMOKE_CONFIRM is not satisfied.',
  );
  process.exit(1);
}

const model = process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini';
const started = Date.now();

try {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    project: process.env.OPENAI_PROJECT_ID || undefined,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000),
    maxRetries: 0,
  });
  const response = await client.responses.create({
    model,
    input: 'Reply with the single word ok.',
    max_output_tokens: 16,
  });
  const text = typeof response.output_text === 'string' ? response.output_text.trim() : '';
  if (!text) {
    console.error('status=failed');
    console.error('reason=empty_output');
    process.exit(1);
  }
  console.log('status=ok');
  console.log(`model=${model}`);
  console.log(`latency_ms=${Date.now() - started}`);
  console.log(`input_tokens=${response.usage?.input_tokens ?? 0}`);
  console.log(`output_tokens=${response.usage?.output_tokens ?? 0}`);
  process.exit(0);
} catch (err) {
  const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined;
  console.error('status=failed');
  console.error(`reason=${status ? `http_${status}` : 'provider_error'}`);
  process.exit(1);
}
