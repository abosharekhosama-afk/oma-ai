import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { inDays, seedContentBrand, seedSocialPage } from '../helpers/content-test';

type ResetView = { approval_reset?: { from: string; fields: string[]; unscheduled: boolean } };

describe('approval lock covers every publishable mutation path (DEC-025)', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  async function approvedPost(opts: { lock: boolean; mode?: string; pages?: number }) {
    const ctx = await seedContentBrand();
    closers.push(async () => ctx.seed.app.close());
    const { seed, brandId, api } = ctx;
    expect(
      (
        await api.prefs(brandId, {
          approvalMode: opts.mode ?? 'required',
          lockAfterApproval: opts.lock,
        })
      ).status,
    ).toBe(200);
    const pages: string[] = [];
    for (let i = 0; i < (opts.pages ?? 2); i++) {
      pages.push(await seedSocialPage(seed, brandId, { network: i ? 'FACEBOOK' : 'INSTAGRAM' }));
    }
    const post = (await api.create(brandId)).body.data;
    expect((await api.targets(post.id, pages)).status).toBe(201);
    expect((await api.act(post.id, 'request-approval')).status).toBe(201);
    const approved = await api.act(post.id, 'approve');
    expect(approved.body.data.approval_state).toBe('APPROVED');
    return { ...ctx, id: post.id, pages };
  }

  it('rejects every publishable change with 409 error.content_locked while locked', async () => {
    const { api, id, pages, seed } = await approvedPost({ lock: true });
    const attempts: Array<
      [string, Promise<{ status: number; body: { error?: { message_key: string } } }>]
    > = [
      ['PATCH title', api.patch(id, { title: { en: 'Changed', ar: 'تغيّر' } })],
      ['PATCH caption', api.patch(id, { caption: { en: 'Changed', ar: 'تغيّر' } })],
      ['PATCH channel', api.patch(id, { channel: 'facebook' })],
      ['PATCH media', api.patch(id, { media_asset_ids: [], caption: { en: 'x', ar: 'x' } })],
      ['publish-target', api.targets(id, [pages[0]!])],
      ['preferred-audience', api.act(id, 'preferred-audience', { audience: 'Students' })],
      ['detach', api.act(id, 'detach', { socialPageId: pages[1] })],
      ['ungroup', api.act(id, 'ungroup')],
    ];
    for (const [label, p] of attempts) {
      const res = await p;
      expect({ label, status: res.status, key: res.body.error?.message_key }).toEqual({
        label,
        status: 409,
        key: 'error.content_locked',
      });
    }
    const row = await getPrisma().contentItem.findUniqueOrThrow({
      where: { id },
      include: { publishTargets: true },
    });
    expect(row.titleEn).toBe('Launch post');
    expect(row.approvalState).toBe('APPROVED');
    expect(row.publishTargets).toHaveLength(2);
    expect(row.preferredAudience).toBeNull();
    expect(await getPrisma().contentItem.count({ where: { tenantId: seed.tenantId } })).toBe(1);
  });

  it('keeps planning metadata and no-op saves editable while locked', async () => {
    const { api, id, pages } = await approvedPost({ lock: true });
    const res = await api.patch(id, {
      title: { en: 'Launch post', ar: 'منشور الإطلاق' },
      plannedAt: inDays(3),
      labels: ['launch'],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.approval_state).toBe('APPROVED');
    expect((await api.act(id, 'labels', { labels: ['q4'] })).status).toBe(201);
    expect((await api.act(id, 'visibility', { clientVisible: false })).status).toBe(201);
    expect((await api.targets(id, [...pages].reverse())).status).toBe(201);
  });

  it('unlocks only through reopen (reason required) or request-changes, both audited', async () => {
    const { api, id, seed } = await approvedPost({ lock: true });
    expect((await api.act(id, 'schedule', { scheduledAt: inDays(2) })).status).toBe(201);

    const noReason = await api.act(id, 'reopen', {});
    expect(noReason.status).toBe(400);
    expect(noReason.body.error?.message_key).toBe('error.reopen_reason_required');

    const reopened = await api.act(id, 'reopen', { reason: 'Price changed' });
    expect(reopened.status).toBe(201);
    expect(reopened.body.data).toMatchObject({
      approval_state: 'NOT_REQUESTED',
      schedule_state: 'UNSCHEDULED',
      calendar: { state: 'PLANNED' },
    });
    expect((await api.act(id, 'reopen', { reason: 'again' })).body.error?.message_key).toBe(
      'error.reopen_not_approved',
    );
    expect((await api.patch(id, { caption: { en: 'New price', ar: 'سعر جديد' } })).status).toBe(
      200,
    );

    // Second round, then unlock through request-changes from APPROVED.
    await api.act(id, 'request-approval');
    expect((await api.act(id, 'approve')).body.data.approval_state).toBe('APPROVED');
    const changes = await api.act(id, 'request-changes', { note: 'Use the new logo' });
    expect(changes.status).toBe(201);
    expect(changes.body.data.approval_state).toBe('CHANGES_REQUESTED');

    const events = await getPrisma().contentApprovalEvent.findMany({
      where: { contentId: id },
      orderBy: { at: 'asc' },
    });
    expect(events.find((e) => e.action === 'REOPEN')?.noteEn).toBe('Price changed');
    const audits = await getPrisma().auditEvent.findMany({
      where: { tenantId: seed.tenantId, targetId: id, action: 'content.unlocked' },
    });
    expect(audits.map((a) => a.afterRef?.split(';')[0]).sort()).toEqual([
      'via:reopen',
      'via:request_changes',
    ]);
  });

  it('resets the approval (and unschedules under REQUIRED) when the lock is off', async () => {
    const { api, id, seed } = await approvedPost({ lock: false });
    expect((await api.act(id, 'schedule', { scheduledAt: inDays(2) })).status).toBe(201);
    const res = await api.patch(id, { caption: { en: 'Edited', ar: 'معدّل' } });
    expect(res.status).toBe(200);
    expect((res.body as unknown as ResetView).approval_reset).toEqual({
      from: 'APPROVED',
      fields: ['caption'],
      unscheduled: true,
    });
    expect(res.body.data).toMatchObject({
      approval_state: 'NOT_REQUESTED',
      schedule_state: 'UNSCHEDULED',
      calendar: { state: 'PLANNED' },
    });
    const audit = await getPrisma().auditEvent.findFirst({
      where: { tenantId: seed.tenantId, targetId: id, action: 'content.approval_reset_on_edit' },
    });
    expect(audit?.afterRef).toContain('from:APPROVED');
  });

  it('restarts collected approvals when a partially approved post changes', async () => {
    const ctx = await seedContentBrand();
    closers.push(async () => ctx.seed.app.close());
    const { api, brandId } = ctx;
    await api.prefs(brandId, { approvalMode: 'multi_level', requiredApprovers: 2 });
    const post = (await api.create(brandId)).body.data;
    await api.act(post.id, 'request-approval');
    expect((await api.act(post.id, 'approve')).body.data.approval_state).toBe('PARTIALLY_APPROVED');
    const res = await api.patch(post.id, { title: { en: 'v2', ar: 'v2' } });
    expect((res.body as unknown as ResetView).approval_reset?.from).toBe('PARTIALLY_APPROVED');
    expect(res.body.data.approval_state).toBe('PENDING');
    const row = await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.approverApproved).toBe(0);
    // The restarted round accepts the same approver again.
    expect((await api.act(post.id, 'approve')).body.data.approval_state).toBe('PARTIALLY_APPROVED');
  });
});
