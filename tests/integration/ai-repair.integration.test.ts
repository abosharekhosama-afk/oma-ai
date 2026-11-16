import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  type BrandSeed,
} from '../helpers/strategy-test';
import { v2Reply } from '../helpers/ai-v2-fixtures';
import { fakeOpenAiEnv, startFakeAiProvider } from '../helpers/fake-ai-provider';

const ENV_KEYS = [
  'AI_PROVIDER',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'AI_LIVE_ENABLED',
  'AI_TEST_ADAPTER',
  'AI_MAX_RETRIES',
  'AI_DEFAULT_MODEL',
  'AI_REASONING_MODEL',
  'AI_REPAIR_ATTEMPTS',
];

const valid = v2Reply({
  variants: [
    { text: 'Morning coffee, done right.', rationale: 'a' },
    { text: 'Your daily cup.', rationale: 'b' },
  ],
});

describe('AI repair loop (live path, fake provider)', () => {
  let seed: BrandSeed;
  let brandId: string;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    seed = await seedBrandTenant();
    brandId = (await createBrand(seed)).body.data.id as string;
  });
  afterAll(async () => {
    await seed.app.close();
  });
  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  async function caption() {
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/ai/captions`, {
      method: 'POST',
      headers: authHeaders(seed, { 'Idempotency-Key': `r-${newId()}` }) as Record<string, string>,
      body: JSON.stringify({ channel: 'instagram', language: 'en' }),
    });
    return { res, body: (await res.json()) as { data?: { run_id: string } } };
  }

  it('repairs a schema-invalid reply once and bills both calls', async () => {
    const fake = await startFakeAiProvider([
      { content: '{"variants": "oops"}', inputTokens: 1000, outputTokens: 100 },
      { content: valid, inputTokens: 1100, outputTokens: 200 },
    ]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      const r = await caption();
      expect([200, 201]).toContain(r.res.status);
      const run = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: r.body.data!.run_id } });
      expect(run).toMatchObject({
        status: 'SUCCEEDED',
        attemptCount: 2,
        inputTokens: 2100,
        outputTokens: 300,
      });
      expect(fake.requests).toHaveLength(2);
      const repairInput = fake.requests[1]!.body.input as Array<{ role: string; content: string }>;
      expect(repairInput.at(-2)).toMatchObject({ role: 'assistant' });
      expect(repairInput.at(-1)!.content).toContain('rejected by the validator');
    } finally {
      await fake.close();
    }
  });

  it('respects AI_REPAIR_ATTEMPTS=0', async () => {
    const fake = await startFakeAiProvider([{ content: 'nope' }, { content: valid }]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      process.env.AI_REPAIR_ATTEMPTS = '0';
      const r = await caption();
      expect(r.res.status).toBe(422);
      expect(fake.requests).toHaveLength(1);
    } finally {
      await fake.close();
    }
  });

  it('falls back to json_object when the provider rejects the schema', async () => {
    const fake = await startFakeAiProvider([
      {
        content: '',
        status: 400,
        errorMessage: "Invalid schema for response_format 'oma_text_proposal'",
      },
      { content: valid },
    ]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      const r = await caption();
      expect([200, 201]).toContain(r.res.status);
      expect(fake.requests).toHaveLength(2);
      const first = fake.requests[0]!.body.text as { format: { type: string } };
      const second = fake.requests[1]!.body.text as { format: { type: string } };
      expect(first.format.type).toBe('json_schema');
      expect(second.format.type).toBe('json_object');
    } finally {
      await fake.close();
    }
  });
});
