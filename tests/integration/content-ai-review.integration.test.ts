import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { findDuePublishTargetIds } from '../../apps/worker/src/social/due-publish-targets';
import type { BrandSeed } from '../helpers/brand-test';
import { inDays, seedContentBrand, seedSocialPage } from '../helpers/content-test';

type AiView = {
  ai: {
    assisted: boolean;
    run_ids: string[];
    reviewed_at: string | null;
    review_required: boolean;
  };
};

async function seedAiRun(seed: BrandSeed, status: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED') {
  const id = newId();
  await getPrisma().aiRun.create({
    data: {
      id,
      tenantId: seed.tenantId,
      actorUserId: seed.userId,
      useCase: 'content.caption',
      provider: 'test',
      model: 'test',
      promptVersion: 'v1',
      schemaVersion: 'v1',
      sourceEntityType: 'brand',
      sourceEntityId: 'b',
      sourceVersion: 'none',
      idempotencyKey: id,
      inputHash: id,
      status,
    },
  });
  return id;
}

describe('AI-assisted content needs a human review before scheduling (DEC-024)', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });
  async function setup() {
    const ctx = await seedContentBrand();
    closers.push(async () => ctx.seed.app.close());
    return ctx;
  }

  it('blocks scheduling under policy NONE until a person confirms the AI review', async () => {
    const { seed, brandId, api } = await setup();
    await api.prefs(brandId, { approvalMode: 'none' });
    const page = await seedSocialPage(seed, brandId);
    const run = await seedAiRun(seed);

    const created = await api.create(brandId, { ai_run_ids: [run] });
    expect(created.status).toBe(201);
    const post = created.body.data as typeof created.body.data & AiView;
    expect(post.ai).toMatchObject({ assisted: true, run_ids: [run], review_required: true });
    await api.targets(post.id, [page]);

    const blocked = await api.act(post.id, 'schedule', { scheduledAt: inDays(1) });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error?.details[0]).toMatchObject({
      policy: 'NONE',
      blockers: [{ code: 'AI_REVIEW_REQUIRED' }],
    });

    const reviewed = await api.act(post.id, 'ai-review', { note: 'Checked claims' });
    expect(reviewed.status).toBe(201);
    expect((reviewed.body.data as unknown as AiView).ai).toMatchObject({
      review_required: false,
    });
    expect((await api.act(post.id, 'ai-review')).body.error?.message_key).toBe(
      'error.ai_review_already_done',
    );
    expect((await api.act(post.id, 'schedule', { scheduledAt: inDays(1) })).status).toBe(201);

    const events = await getPrisma().contentApprovalEvent.findMany({
      where: { contentId: post.id, action: 'AI_REVIEW' },
    });
    expect(events).toHaveLength(1);
    expect(
      await getPrisma().auditEvent.count({
        where: { tenantId: seed.tenantId, action: 'content.ai_reviewed', targetId: post.id },
      }),
    ).toBe(1);
  });

  it('new AI output clears the review; human edits do not', async () => {
    const { seed, brandId, api } = await setup();
    const run1 = await seedAiRun(seed);
    const run2 = await seedAiRun(seed);
    const post = (await api.create(brandId, { ai_run_ids: [run1] })).body.data;
    await api.act(post.id, 'ai-review');

    const human = (await api.patch(post.id, { caption: { en: 'Human tweak' } })).body
      .data as unknown as AiView;
    expect(human.ai.review_required).toBe(false);

    const again = (await api.patch(post.id, { caption: { en: 'AI v2' }, ai_run_ids: [run2] })).body
      .data as unknown as AiView;
    expect(again.ai).toMatchObject({ review_required: true, run_ids: [run1, run2] });

    const copy = (await api.act(post.id, 'duplicate')).body.data as unknown as AiView;
    expect(copy.ai).toMatchObject({ assisted: true, review_required: true });

    const plain = (await api.create(brandId)).body.data;
    expect((await api.act(plain.id, 'ai-review')).body.error?.message_key).toBe(
      'error.ai_review_not_needed',
    );
  });

  it('rejects unknown, failed or foreign AI runs', async () => {
    const { seed, brandId, api } = await setup();
    const failed = await seedAiRun(seed, 'FAILED');
    expect((await api.create(brandId, { ai_run_ids: [failed] })).status).toBe(400);
    expect((await api.create(brandId, { ai_run_ids: ['nope'] })).status).toBe(400);
    expect((await api.create(brandId, { ai_run_ids: 'x' })).status).toBe(400);
    const other = await seedContentBrand();
    closers.push(async () => other.seed.app.close());
    const foreign = await seedAiRun(other.seed);
    expect((await api.create(brandId, { ai_run_ids: [foreign] })).status).toBe(400);
  });

  it('a completed approval round counts as the AI review', async () => {
    const { seed, brandId, api } = await setup();
    await api.prefs(brandId, { approvalMode: 'required' });
    const run = await seedAiRun(seed);
    const post = (await api.create(brandId, { ai_run_ids: [run] })).body.data;
    await api.act(post.id, 'request-approval');
    const approved = (await api.act(post.id, 'approve')).body.data as unknown as AiView;
    expect(approved.ai).toMatchObject({ review_required: false });
    expect(approved.ai.reviewed_at).not.toBeNull();
  });

  it('the worker never publishes unreviewed AI copy', async () => {
    const { seed, brandId, api } = await setup();
    await api.prefs(brandId, { approvalMode: 'none' });
    const page = await seedSocialPage(seed, brandId);
    const run = await seedAiRun(seed);
    const post = (await api.create(brandId, { ai_run_ids: [run] })).body.data;
    await api.targets(post.id, [page]);
    // Simulate a post scheduled before the gate existed.
    await getPrisma().contentItem.update({
      where: { id: post.id },
      data: {
        scheduleState: 'SCHEDULED',
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 1000),
      },
    });
    await getPrisma().contentPublishTarget.updateMany({
      where: { contentItemId: post.id },
      data: { publishState: 'QUEUED' },
    });
    const due = await findDuePublishTargetIds(new Date(), Buffer.alloc(32, 1));
    const targetIds = (
      await getPrisma().contentPublishTarget.findMany({ where: { contentItemId: post.id } })
    ).map((t) => t.id);
    expect(due.ids.filter((id) => targetIds.includes(id))).toEqual([]);
    const row = await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.lastPublishSkipReason).toMatch(/human review/i);
    const got = (await api.get(post.id)).body.data;
    expect(got.calendar.state).toBe('CANNOT_SCHEDULE');
  });
});
