import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  authHeaders,
  grantCapability,
  seedMemberWithoutBrandCaps,
  type BrandSeed,
} from '../helpers/brand-test';
import { contentApi, seedContentBrand } from '../helpers/content-test';

type Summary = {
  approval_levels: {
    total: number;
    completed: number;
    current: { position: number; name: { en: string } } | null;
  } | null;
  approver_required: number;
};
type Progress = {
  mode: 'levels' | 'counter';
  levels: Array<{
    position: number;
    status: string;
    approvals: number;
    decisions: Array<{ user_id: string; user_name: string | null; decision: string }>;
  }>;
  decisions: Array<{ decision: string }>;
};

async function approver(seed: BrandSeed) {
  const m = await seedMemberWithoutBrandCaps(seed);
  await grantCapability(seed.tenantId, m.membershipId, 'content.approve', seed.userId);
  return {
    id: m.userId,
    api: contentApi(seed, authHeaders({ ...seed, cookies: m.cookies, csrf: m.csrf })),
  };
}

describe('multi-level approval (DEC-026)', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  async function setup() {
    const ctx = await seedContentBrand();
    closers.push(async () => ctx.seed.app.close());
    const editor = await approver(ctx.seed);
    const client = await approver(ctx.seed);
    await ctx.api.prefs(ctx.brandId, { approvalMode: 'multi_level' });
    const levels = await ctx.api.call('PUT', '/workspace/approval-levels', {
      levels: [
        { name: { en: 'Editor', ar: 'المحرر' }, approver_user_ids: [editor.id] },
        { name: { en: 'Client', ar: 'العميل' }, approver_user_ids: [client.id] },
      ],
    });
    expect(levels.status).toBe(200);
    return { ...ctx, editor, client };
  }

  async function requested(ctx: Awaited<ReturnType<typeof setup>>) {
    const post = (await ctx.api.create(ctx.brandId)).body.data;
    const res = await ctx.api.act(post.id, 'request-approval');
    expect(res.status).toBe(201);
    return { id: post.id, row: res.body.data as unknown as Summary };
  }

  it('validates and protects the level settings', async () => {
    const { api, editor, brandId } = await setup();
    const unknown = await api.call('PUT', '/workspace/approval-levels', {
      levels: [{ name: 'Editor', approver_user_ids: ['not-a-member'] }],
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error?.message_key).toBe('error.approval_levels_invalid');
    expect(
      (await editor.api.call('PUT', '/workspace/approval-levels', { levels: [] })).status,
    ).toBe(403);
    const view = await api.call<{
      levels: unknown[];
      workspace_levels: Array<{
        name: { en: string };
        approvers: Array<{ id: string; name: string }>;
      }>;
      effective_source: string;
    }>('GET', `/brands/${brandId}/approval-levels`);
    expect(view.body.data.levels).toEqual([]);
    expect(view.body.data.workspace_levels.map((l) => l.name.en)).toEqual(['Editor', 'Client']);
    expect(view.body.data.workspace_levels[0]!.approvers[0]!.id).toBe(editor.id);
    expect(view.body.data.effective_source).toBe('workspace');
  });

  it('enforces order, assignment and one decision per level per round', async () => {
    const ctx = await setup();
    const { api, editor, client } = ctx;
    const { id, row } = await requested(ctx);
    expect(row.approver_required).toBe(2);
    expect(row.approval_levels).toMatchObject({
      total: 2,
      completed: 0,
      current: { position: 1, name: { en: 'Editor' } },
    });

    const early = await client.api.act(id, 'approve');
    expect(early.status).toBe(409);
    expect(early.body.error?.message_key).toBe('error.approval_level_not_reached');
    const stranger = await api.act(id, 'approve');
    expect(stranger.status).toBe(403);
    expect(stranger.body.error?.message_key).toBe('error.approval_not_assigned');
    expect((await editor.api.act(id, 'approve', { level: 2 })).status).toBe(409);

    const first = await editor.api.act(id, 'approve', { note: 'Copy OK' });
    expect(first.body.data.approval_state).toBe('PARTIALLY_APPROVED');
    expect((first.body.data as unknown as Summary).approval_levels?.completed).toBe(1);
    expect((await editor.api.act(id, 'approve')).status).toBe(403);

    const last = await client.api.act(id, 'approve');
    expect(last.body.data.approval_state).toBe('APPROVED');

    const progress = await api.call<Progress>('GET', `/content/${id}/approval`);
    expect(progress.body.data.mode).toBe('levels');
    expect(progress.body.data.levels.map((l) => [l.status, l.approvals])).toEqual([
      ['done', 1],
      ['done', 1],
    ]);
    expect(progress.body.data.levels[0]!.decisions[0]).toMatchObject({
      user_id: editor.id,
      user_name: 'Member',
      decision: 'APPROVED',
    });
  });

  it('freezes the plan per round and records request-changes per level', async () => {
    const ctx = await setup();
    const { api, editor, client } = ctx;
    const { id } = await requested(ctx);
    await api.call('PUT', '/workspace/approval-levels', {
      levels: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });
    expect(((await api.get(id)).body.data as unknown as Summary).approval_levels?.total).toBe(2);

    expect((await api.act(id, 'request-changes', { note: 'no' })).status).toBe(403);
    await editor.api.act(id, 'approve');
    const changes = await client.api.act(id, 'request-changes', { note: 'Fix the price' });
    expect(changes.body.data.approval_state).toBe('CHANGES_REQUESTED');
    const decisions = await getPrisma().contentApprovalDecision.findMany({
      where: { contentId: id },
      orderBy: { at: 'asc' },
    });
    expect(decisions.map((d) => [d.levelPosition, d.decision])).toEqual([
      [1, 'APPROVED'],
      [2, 'CHANGES_REQUESTED'],
    ]);
    // The next round uses the new three-level plan.
    const again = await api.act(id, 'request-approval');
    expect((again.body.data as unknown as Summary).approval_levels?.total).toBe(3);
  });

  it('restarts the round when the post changes mid-review', async () => {
    const ctx = await setup();
    const { api, editor } = ctx;
    const { id } = await requested(ctx);
    await editor.api.act(id, 'approve');
    const edited = await api.patch(id, { caption: { en: 'v2', ar: 'v2' } });
    expect(edited.body.data.approval_state).toBe('PENDING');
    const progress = await api.call<Progress>('GET', `/content/${id}/approval`);
    expect(progress.body.data.decisions).toEqual([]);
    expect(progress.body.data.levels[0]!.status).toBe('current');
    expect((await editor.api.act(id, 'approve')).body.data.approval_state).toBe(
      'PARTIALLY_APPROVED',
    );
  });

  it('falls back to the approver counter when no levels are configured', async () => {
    const ctx = await seedContentBrand();
    closers.push(async () => ctx.seed.app.close());
    await ctx.api.prefs(ctx.brandId, { approvalMode: 'multi_level', requiredApprovers: 2 });
    const post = (await ctx.api.create(ctx.brandId)).body.data;
    const res = await ctx.api.act(post.id, 'request-approval');
    expect(res.body.data).toMatchObject({ approver_required: 2, approval_levels: null });
    const progress = await ctx.api.call<Progress>('GET', `/content/${post.id}/approval`);
    expect(progress.body.data.mode).toBe('counter');
  });
});
