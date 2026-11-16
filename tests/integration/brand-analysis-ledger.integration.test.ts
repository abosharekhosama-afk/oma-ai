import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { AI_PROPOSAL_BANNER, newId } from '@oma/domain';
import { runBrandProfileAnalysis } from '../../apps/worker/src/brand/brand-analysis.service';
import {
  createBrand,
  seedBrandTenant,
  seedEvidenceExcerpt,
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
];

describe('brand analysis worker: unified run ledger', () => {
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

  async function fixture() {
    const evidenceId = await seedEvidenceExcerpt(
      seed.tenantId,
      brandId,
      seed.userId,
      'We roast coffee.',
    );
    const evidence = await getPrisma().evidenceExcerpt.findUniqueOrThrow({
      where: { id: evidenceId },
    });
    const profileVersionId = newId();
    await getPrisma().profileVersion.create({
      data: { id: profileVersionId, tenantId: seed.tenantId, brandId, status: 'DRAFT' },
    });
    return { evidenceId, scanAttemptId: evidence.scanAttemptId, profileVersionId };
  }

  function run(f: Awaited<ReturnType<typeof fixture>>, key = `ba-${newId()}`) {
    return runBrandProfileAnalysis({
      tenantId: seed.tenantId,
      brandId,
      scanAttemptId: f.scanAttemptId,
      profileVersionId: f.profileVersionId,
      actorUserId: seed.userId,
      idempotencyKey: key,
    });
  }

  it('test adapter: settles the run and writes only PENDING AI claims', async () => {
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    const f = await fixture();
    const result = await run(f);
    expect(result.ok).toBe(true);
    const row = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: result.runId! } });
    expect(row).toMatchObject({ status: 'SUCCEEDED', reservedCost: '0', attemptCount: 1 });
    expect(row.latencyMs).not.toBeNull();
    const claims = await getPrisma().insightClaim.findMany({
      where: { tenantId: seed.tenantId, profileVersionId: f.profileVersionId },
    });
    expect(claims.every((c) => c.reviewStatus === 'PENDING' && c.createdBy === 'AI')).toBe(true);
  });

  it('live invalid JSON: records SCHEMA_INVALID with cost and marks the scan failed', async () => {
    const fake = await startFakeAiProvider([
      { content: '{"broken": ', inputTokens: 3000, outputTokens: 10 },
    ]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      const f = await fixture();
      const result = await run(f);
      expect(result).toMatchObject({ ok: false, errorCode: 'SCHEMA_INVALID' });
      const row = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: result.runId! } });
      expect(row).toMatchObject({
        status: 'SCHEMA_INVALID',
        failureStage: 'parse',
        reservedCost: '0',
        inputTokens: 6000,
        attemptCount: 2,
      });
      expect(Number(row.settledCost)).toBeGreaterThan(0);
      const scan = await getPrisma().scanAttempt.findUniqueOrThrow({
        where: { id: f.scanAttemptId },
      });
      expect(scan.analysisErrorCode).toBe('SCHEMA_INVALID');
    } finally {
      await fake.close();
    }
  });

  it('live success after a failure reuses the run row for the same job key', async () => {
    const proposal = {
      promptId: 'oma.brand_profile_synthesis',
      promptVersion: '2',
      schemaVersion: '1',
      language: 'en',
      sourceVersion: 'x',
      evidenceRefs: [],
      items: [],
      banner: AI_PROPOSAL_BANNER,
    };
    const fake = await startFakeAiProvider([
      { content: 'nope' },
      { content: 'still nope' },
      { content: JSON.stringify(proposal) },
    ]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      const f = await fixture();
      const key = `ba-${newId()}`;
      const first = await run(f, key);
      expect(first.ok).toBe(false);
      const second = await run(f, key);
      expect(second.ok).toBe(true);
      expect(second.runId).toBe(first.runId);
      const row = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: second.runId! } });
      expect(row.status).toBe('SUCCEEDED');
    } finally {
      await fake.close();
    }
  });
});
