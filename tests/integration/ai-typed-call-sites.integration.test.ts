import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { AI_PROPOSAL_BANNER, newId } from '@oma/domain';
import { runBrandProfileAnalysis } from '../../apps/worker/src/brand/brand-analysis.service';
import {
  authHeaders,
  createBrand,
  createStrategy,
  getStrategyVersion,
  seedApprovedProfileVersion,
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
  'STRATEGY_AI_MODE',
];

type Body = {
  data?: Record<string, unknown> & { run_id?: string; proposal?: Record<string, unknown> };
  error?: { code: string; details?: Array<Record<string, unknown>> };
};

async function post(seed: BrandSeed, url: string, body: unknown = {}, key?: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(seed, key ? { 'Idempotency-Key': key } : {}) as Record<string, string>,
    body: JSON.stringify(body),
  });
  return { res, body: (await res.json()) as Body };
}

async function legacyRun(input: {
  tenantId: string;
  actorUserId: string;
  useCase: string;
  sourceEntityType: string;
  sourceEntityId: string;
}) {
  const id = newId();
  await getPrisma().aiRun.create({
    data: {
      id,
      ...input,
      provider: 'test-adapter',
      model: 'test-adapter-v1',
      promptVersion: '1',
      schemaVersion: '1',
      sourceVersion: 'v1',
      status: 'SUCCEEDED',
      idempotencyKey: `legacy-${id}`,
      inputHash: 'x',
      proposalJson: JSON.stringify({
        promptId: 'oma.legacy',
        promptVersion: '1',
        schemaVersion: '1',
        language: 'en',
        sourceVersion: 'v1',
        evidenceRefs: [],
        items: [{ field: 'foundation.goals', value: 'Grow. Win.', kind: 'proposal' }],
        banner: AI_PROPOSAL_BANNER,
      }),
    },
  });
  return id;
}

describe('typed AI call sites (v2 contracts)', () => {
  let seed: BrandSeed;
  let brandId: string;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    seed = await seedBrandTenant();
    brandId = (await createBrand(seed)).body.data.id as string;
    await seedApprovedProfileVersion(seed.tenantId, brandId);
  });
  afterAll(async () => {
    await seed.app.close();
  });
  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    process.env.STRATEGY_AI_MODE = 'live';
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  async function newStrategy(paid = false) {
    const { body } = await createStrategy(seed, brandId, {
      organic_enabled: true,
      paid_enabled: paid,
    });
    const strategyId = body.data.id as string;
    const versionId = body.data.latest_version.id as string;
    const url = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/ai/propose`;
    return { strategyId, versionId, url };
  }

  it('legacy strategy propose returns a typed v2 proposal and accept copies typed lists', async () => {
    const s = await newStrategy();
    const proposed = await post(seed, s.url, {}, `p-${newId()}`);
    expect([200, 201]).toContain(proposed.res.status);
    const proposal = proposed.body.data!.proposal as {
      schemaVersion: string;
      foundation: { goals: string[] };
      paid: unknown;
    };
    expect(proposal.schemaVersion).toBe('2');
    expect(Array.isArray(proposal.foundation.goals)).toBe(true);
    expect(proposal.paid).toBeNull();
    const run = await getPrisma().aiRun.findUniqueOrThrow({
      where: { id: proposed.body.data!.run_id as string },
    });
    expect(run).toMatchObject({ contractId: 'strategy.foundation', schemaVersion: '2' });

    const accepted = await post(seed, `${s.url}/accept`, { run_id: run.id });
    expect([200, 201]).toContain(accepted.res.status);
    const after = await getStrategyVersion(seed, brandId, s.strategyId, s.versionId);
    const goals = (after.body.data.foundation.goals as Array<{ value: string }>).map(
      (g) => g.value,
    );
    expect(goals).toEqual(proposal.foundation.goals);
  });

  it('v1 strategy proposals are display-only: accept asks to regenerate', async () => {
    const s = await newStrategy();
    const runId = await legacyRun({
      tenantId: seed.tenantId,
      actorUserId: seed.userId,
      useCase: 'organic_strategy',
      sourceEntityType: 'strategy_version',
      sourceEntityId: s.versionId,
    });
    const accepted = await post(seed, `${s.url}/accept`, { run_id: runId });
    expect(accepted.res.status).toBe(409);
    expect(accepted.body.error?.details?.[0]).toMatchObject({ code: 'LEGACY_PROPOSAL' });
  });

  it('v1 generic runs are display-only too', async () => {
    const runId = await legacyRun({
      tenantId: seed.tenantId,
      actorUserId: seed.userId,
      useCase: 'brand_profile_synthesis',
      sourceEntityType: 'brand_profile',
      sourceEntityId: brandId,
    });
    const accepted = await post(seed, `${seed.baseUrl}/api/v1/ai/runs/${runId}/accept`);
    expect(accepted.res.status).toBe(409);
    expect(accepted.body.error?.details?.[0]).toMatchObject({ code: 'LEGACY_PROPOSAL' });
  });

  it('generic runs use the brand.analysis contract and can be accepted', async () => {
    const evidence = await seedEvidenceExcerpt(seed.tenantId, brandId, seed.userId);
    const created = await post(seed, `${seed.baseUrl}/api/v1/ai/runs`, {
      use_case: 'brand_profile_synthesis',
      source_entity_type: 'brand_profile',
      source_entity_id: brandId,
      source_version: 'v1',
      idempotency_key: `g-${newId()}`,
      evidence_refs: [evidence],
    });
    expect([200, 201]).toContain(created.res.status);
    const runId = (created.body.data as { run: { id: string } }).run.id;
    const row = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: runId } });
    expect(row).toMatchObject({ contractId: 'brand.analysis', schemaVersion: '2' });
    const accepted = await post(seed, `${seed.baseUrl}/api/v1/ai/runs/${runId}/accept`);
    expect([200, 201]).toContain(accepted.res.status);
  });

  it('brand analysis worker rejects an evidence id it never sent, then repairs', async () => {
    const evidenceId = await seedEvidenceExcerpt(seed.tenantId, brandId, seed.userId, 'We roast.');
    const evidence = await getPrisma().evidenceExcerpt.findUniqueOrThrow({
      where: { id: evidenceId },
    });
    const profileVersionId = newId();
    await getPrisma().profileVersion.create({
      data: { id: profileVersionId, tenantId: seed.tenantId, brandId, status: 'DRAFT' },
    });
    const reply = (ref: string) =>
      JSON.stringify({
        promptId: 'oma.brand_profile_synthesis',
        promptVersion: '3',
        schemaVersion: '2',
        language: 'en',
        sourceVersion: profileVersionId,
        banner: AI_PROPOSAL_BANNER,
        evidenceRefs: [ref],
        items: [
          {
            field: 'brand.description',
            value: 'A coffee roaster.',
            kind: 'fact',
            confidence: 0.8,
            evidenceRefs: [ref],
          },
        ],
      });
    const fake = await startFakeAiProvider([
      { content: reply('made-up-id') },
      { content: reply(evidenceId) },
    ]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      const result = await runBrandProfileAnalysis({
        tenantId: seed.tenantId,
        brandId,
        scanAttemptId: evidence.scanAttemptId,
        profileVersionId,
        actorUserId: seed.userId,
        idempotencyKey: `ba-${newId()}`,
      });
      expect(result.ok).toBe(true);
      expect(fake.requests).toHaveLength(2);
      expect(JSON.stringify(fake.requests[1]!.body)).toContain('unknown evidence id');
      const row = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: result.runId! } });
      expect(row).toMatchObject({
        contractId: 'brand.analysis',
        schemaVersion: '2',
        attemptCount: 2,
      });
      const claims = await getPrisma().insightClaim.findMany({
        where: { tenantId: seed.tenantId, profileVersionId },
      });
      expect(claims.map((c) => c.evidenceId)).toEqual([evidenceId]);
    } finally {
      await fake.close();
    }
  });
});
