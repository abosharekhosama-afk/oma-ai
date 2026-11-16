import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { AI_PROPOSAL_BANNER, newId } from '@oma/domain';
import { runBrandProfileAnalysis } from '../../apps/worker/src/brand/brand-analysis.service';
import {
  authHeaders,
  createBrand,
  createStrategy,
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
  data?: Record<string, unknown>;
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

const audits = (tenantId: string, action: string) =>
  getPrisma().auditEvent.findMany({ where: { tenantId, action } });

describe('draft-only invariant (integration)', () => {
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

  async function genericRun() {
    const evidence = await seedEvidenceExcerpt(seed.tenantId, brandId, seed.userId);
    const created = await post(seed, `${seed.baseUrl}/api/v1/ai/runs`, {
      use_case: 'brand_profile_synthesis',
      source_entity_type: 'brand_profile',
      source_entity_id: brandId,
      source_version: 'v1',
      idempotency_key: `d-${newId()}`,
      evidence_refs: [evidence],
    });
    return (created.body.data as { run: { id: string } }).run.id;
  }

  it('generic accept creates a DRAFT with ai_run_id and an audit event by the person', async () => {
    const runId = await genericRun();
    const accepted = await post(seed, `${seed.baseUrl}/api/v1/ai/runs/${runId}/accept`);
    expect([200, 201]).toContain(accepted.res.status);
    const draftId = accepted.body.data!.draft_id as string;
    const draft = await getPrisma().profileVersion.findUniqueOrThrow({ where: { id: draftId } });
    expect(draft.status).toBe('DRAFT');
    expect(JSON.parse(draft.sectionsJson!).ai_run_id).toBe(runId);
    const events = await audits(seed.tenantId, 'ai.run.accepted');
    expect(events.find((e) => e.targetId === draftId)).toMatchObject({
      actorUserId: seed.userId,
      afterRef: `ai_run:${runId}`,
    });
  });

  it('generic reject is audited', async () => {
    const runId = await genericRun();
    const rejected = await post(seed, `${seed.baseUrl}/api/v1/ai/runs/${runId}/reject`, {
      reason: 'Off brand',
    });
    expect([200, 201]).toContain(rejected.res.status);
    const events = await audits(seed.tenantId, 'ai.run.rejected');
    expect(events.find((e) => e.targetId === runId)).toMatchObject({
      actorUserId: seed.userId,
      afterRef: 'reason:Off brand',
    });
  });

  it('strategy accept and reject are audited with the run id', async () => {
    const { body } = await createStrategy(seed, brandId, {
      organic_enabled: true,
      paid_enabled: false,
    });
    const versionId = body.data.latest_version.id as string;
    const url = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${body.data.id}/versions/${versionId}/ai/propose`;
    const first = await post(seed, url, {}, `s-${newId()}`);
    const runId = first.body.data!.run_id as string;
    expect([200, 201]).toContain((await post(seed, `${url}/reject`, { run_id: runId })).res.status);
    expect(
      (await audits(seed.tenantId, 'strategy.ai_proposal_rejected')).some(
        (e) => e.afterRef === `ai_run:${runId}` && e.targetId === versionId,
      ),
    ).toBe(true);
    const second = await post(seed, url, { regenerate: true }, `s-${newId()}`);
    const runId2 = second.body.data!.run_id as string;
    expect([200, 201]).toContain(
      (await post(seed, `${url}/accept`, { run_id: runId2 })).res.status,
    );
    expect(
      (await audits(seed.tenantId, 'strategy.ai_proposal_accepted')).some(
        (e) => e.afterRef === `ai_run:${runId2}` && e.actorUserId === seed.userId,
      ),
    ).toBe(true);
  });

  it('brand analysis never writes a profile that was approved while the model ran', async () => {
    const evidenceId = await seedEvidenceExcerpt(seed.tenantId, brandId, seed.userId, 'We roast.');
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
        sectionsJson: JSON.stringify({ overview: { description: 'Human text' } }),
      },
    });
    const reply = JSON.stringify({
      promptId: 'oma.brand_profile_synthesis',
      promptVersion: '3',
      schemaVersion: '2',
      language: 'en',
      sourceVersion: profileVersionId,
      banner: AI_PROPOSAL_BANNER,
      evidenceRefs: [evidenceId],
      items: [
        {
          field: 'brand.description',
          value: 'AI text',
          kind: 'fact',
          confidence: 0.9,
          evidenceRefs: [evidenceId],
        },
      ],
    });
    const fake = await startFakeAiProvider([{ content: reply, delayMs: 400 }]);
    try {
      Object.assign(process.env, fakeOpenAiEnv(fake.baseUrl));
      const pending = runBrandProfileAnalysis({
        tenantId: seed.tenantId,
        brandId,
        scanAttemptId: evidence.scanAttemptId,
        profileVersionId,
        actorUserId: seed.userId,
        idempotencyKey: `race-${newId()}`,
      });
      await new Promise((r) => setTimeout(r, 150));
      await getPrisma().profileVersion.update({
        where: { id: profileVersionId },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      const result = await pending;
      const profile = await getPrisma().profileVersion.findUniqueOrThrow({
        where: { id: profileVersionId },
      });
      expect(JSON.parse(profile.sectionsJson!).overview.description).toBe('Human text');
      expect(
        await getPrisma().insightClaim.count({ where: { profileVersionId, createdBy: 'AI' } }),
      ).toBe(0);
      const scan = await getPrisma().scanAttempt.findUniqueOrThrow({
        where: { id: evidence.scanAttemptId },
      });
      expect(scan.analysisErrorCode).toBe('APPROVED_VERSION_IMMUTABLE');
      const run = await getPrisma().aiRun.findUniqueOrThrow({ where: { id: result.runId! } });
      expect(run.status).toBe('SUCCEEDED');
    } finally {
      await fake.close();
    }
  });
});
