import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma, tenantAiLedgerSnapshot } from '@oma/db';
import { AI_PROPOSAL_BANNER, newId } from '@oma/domain';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  type BrandSeed,
} from '../helpers/strategy-test';
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
  'AI_MONTHLY_BUDGET_USD',
  'AI_DAILY_BUDGET_USD',
];

type GenBody = {
  data?: { run_id: string; replayed: boolean };
  error?: { code: string; details?: Array<Record<string, unknown>> };
};

async function caption(seed: BrandSeed, brandId: string, key?: string, body: object = {}) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/ai/captions`, {
    method: 'POST',
    headers: authHeaders(seed, key ? { 'Idempotency-Key': key } : {}) as Record<string, string>,
    body: JSON.stringify({ channel: 'instagram', language: 'en', ...body }),
  });
  return { res, body: (await res.json()) as GenBody };
}

function validCaption(sourceVersion = 'none') {
  return JSON.stringify({
    promptId: 'oma.caption_generation',
    promptVersion: '1',
    schemaVersion: '1',
    language: 'en',
    sourceVersion,
    banner: AI_PROPOSAL_BANNER,
    variants: [
      { text: 'Fresh coffee every morning.', rationale: 'simple' },
      { text: 'Your daily cup, done right.', rationale: 'warm' },
    ],
    hashtags: ['#coffee'],
    warnings: [],
  });
}

describe('AI run ledger: every call recorded, real latency, safe reservations', () => {
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
  afterEach(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await getPrisma().aiRun.deleteMany({ where: { tenantId: seed.tenantId } });
  });

  it('records an invalid-JSON live call (after its repair attempt) as SCHEMA_INVALID with its billed cost', async () => {
    const fake = await startFakeAiProvider([
      { content: 'this is not json', inputTokens: 2000, outputTokens: 1000 },
    ]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      const r = await caption(seed, brandId, `k-${newId()}`);
      expect(r.res.status).toBe(422);
      expect(r.body.error?.code).toBe('SCHEMA_INVALID');
      const runs = await getPrisma().aiRun.findMany({ where: { tenantId: seed.tenantId } });
      expect(runs).toHaveLength(1);
      const run = runs[0]!;
      expect(run).toMatchObject({
        status: 'SCHEMA_INVALID',
        failureStage: 'parse',
        errorCode: 'SCHEMA_INVALID',
        reservedCost: '0',
        // First call + one repair call (DEC-027 #1), both billed.
        inputTokens: 4000,
        outputTokens: 2000,
        attemptCount: 2,
      });
      expect(Number(run.settledCost)).toBeGreaterThan(0);
      expect(run.latencyMs).not.toBeNull();
      const snapshot = await tenantAiLedgerSnapshot(seed.tenantId);
      expect(snapshot.monthlySpentUsd).toBeCloseTo(Number(run.settledCost), 6);
      expect(snapshot.monthlyReservedUsd).toBe(0);
    } finally {
      await fake.close();
    }
  });

  it('settles a live success with real latency and real usage', async () => {
    const fake = await startFakeAiProvider([
      { content: validCaption(), inputTokens: 1200, outputTokens: 300, delayMs: 60 },
    ]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      const r = await caption(seed, brandId, `k-${newId()}`);
      expect([200, 201]).toContain(r.res.status);
      const run = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: r.body.data!.run_id } });
      expect(run).toMatchObject({
        status: 'SUCCEEDED',
        reservedCost: '0',
        inputTokens: 1200,
        outputTokens: 300,
        failureStage: null,
      });
      expect(run.latencyMs!).toBeGreaterThanOrEqual(50);
      expect(Number(run.settledCost)).toBeGreaterThan(0);
      expect(run.inputHash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await fake.close();
    }
  });

  it('serialises reservations so concurrent calls cannot overrun the budget', async () => {
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    process.env.AI_MONTHLY_BUDGET_USD = '0.07';
    process.env.AI_DAILY_BUDGET_USD = '10';
    const results = await Promise.all([
      caption(seed, brandId, `c1-${newId()}`),
      caption(seed, brandId, `c2-${newId()}`),
      caption(seed, brandId, `c3-${newId()}`),
    ]);
    const statuses = results.map((r) => r.res.status).sort();
    expect(statuses.filter((s) => s === 201 || s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
  });

  it('replays an identical request without an explicit key (no double charge)', async () => {
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    const first = await caption(seed, brandId, undefined, { caption: 'same text' });
    const second = await caption(seed, brandId, undefined, { caption: 'same text' });
    expect([200, 201]).toContain(first.res.status);
    expect(second.body.data!.run_id).toBe(first.body.data!.run_id);
    expect(second.body.data!.replayed).toBe(true);
    const other = await caption(seed, brandId, undefined, { caption: 'different text' });
    expect(other.body.data!.run_id).not.toBe(first.body.data!.run_id);
  });

  it('refuses a duplicate while the same request is still running', async () => {
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    const key = `run-${newId()}`;
    await getPrisma().aiRun.create({
      data: {
        id: newId(),
        tenantId: seed.tenantId,
        actorUserId: seed.userId,
        useCase: 'caption_generation',
        provider: 'test-adapter',
        model: 'test-adapter-v1',
        promptVersion: '1',
        schemaVersion: '1',
        sourceEntityType: 'brand',
        sourceEntityId: brandId,
        sourceVersion: 'none',
        status: 'RUNNING',
        idempotencyKey: key,
        inputHash: 'x',
        reservedCost: '0.05',
      },
    });
    const r = await caption(seed, brandId, key);
    expect(r.res.status).toBe(409);
    expect(r.body.error?.details?.[0]).toMatchObject({ code: 'AI_RUN_IN_PROGRESS' });
  });
});
