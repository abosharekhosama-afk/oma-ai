/**
 * 005 T024 — brand analysis with AI_TEST_ADAPTER produces insight rows.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { enqueueBrandAnalysis, getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { runBrandProfileAnalysis } from '../../apps/worker/src/brand/brand-analysis.service';
import {
  createBrand,
  seedBrandTenant,
  seedEvidenceExcerpt,
  type BrandSeed,
} from '../helpers/strategy-test';

const ENV_KEYS = ['AI_TEST_ADAPTER', 'AI_LIVE_ENABLED'] as const;

describe('scan-analysis AI closure (005 T024)', () => {
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
    process.env.AI_TEST_ADAPTER = '1';
    delete process.env.AI_LIVE_ENABLED;
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('enqueue + worker run leaves SUCCEEDED aiRun and pending AI insights', async () => {
    const evidenceId = await seedEvidenceExcerpt(
      seed.tenantId,
      brandId,
      seed.userId,
      'Premium coffee roasting.',
    );
    const evidence = await getPrisma().evidenceExcerpt.findUniqueOrThrow({
      where: { id: evidenceId },
    });
    const profileVersionId = newId();
    await getPrisma().profileVersion.create({
      data: {
        id: profileVersionId,
        tenantId: seed.tenantId,
        brandId,
        status: 'DRAFT',
        scanAttemptId: evidence.scanAttemptId,
      },
    });

    const enqueued = await enqueueBrandAnalysis({
      tenantId: seed.tenantId,
      brandId,
      scanAttemptId: evidence.scanAttemptId,
      profileVersionId,
      actorUserId: seed.userId,
    });
    expect(enqueued.queued).toBe(true);

    const run = await runBrandProfileAnalysis({
      tenantId: seed.tenantId,
      brandId,
      scanAttemptId: evidence.scanAttemptId,
      profileVersionId,
      actorUserId: seed.userId,
      idempotencyKey: `closure-${newId()}`,
    });
    expect(run.ok).toBe(true);
    expect(run.runId).toBeTruthy();

    const aiRun = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: run.runId! } });
    expect(aiRun.status).toBe('SUCCEEDED');
    expect(aiRun.proposalJson).toBeTruthy();

    const claims = await getPrisma().insightClaim.findMany({
      where: { tenantId: seed.tenantId, profileVersionId, createdBy: 'AI' },
    });
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.some((c) => c.fieldKey === 'brand.description')).toBe(true);
  });
});
