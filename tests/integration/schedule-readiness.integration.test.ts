import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { findDuePublishTargetIds } from '../../apps/worker/src/social/due-publish-targets';
import { inDays, seedContentBrand, seedSocialPage } from '../helpers/content-test';

describe('schedule readiness, connected accounts, Planned vs Scheduled (DEC-023)', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });
  async function setup() {
    const ctx = await seedContentBrand();
    closers.push(async () => ctx.seed.app.close());
    return ctx;
  }

  it('blocks scheduling without a connected account for the channel, then allows it', async () => {
    const { seed, brandId, api } = await setup();
    const post = (await api.create(brandId)).body.data;
    expect((await api.attachTestMedia(brandId, post.id)).status).toBe(200);

    const blocked = await api.act(post.id, 'schedule', { scheduledAt: inDays(2) });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error?.code).toBe('SCHEDULE_BLOCKED');
    const scheduleBlockers = blocked.body.error?.details[0]?.blockers as Array<{ code: string }>;
    expect(scheduleBlockers.map((b) => b.code)).toEqual(
      expect.arrayContaining(['NO_CONNECTED_ACCOUNT']),
    );

    const facebook = await seedSocialPage(seed, brandId, { network: 'FACEBOOK' });
    await api.targets(post.id, [facebook]);
    const readiness = await api.readiness(post.id);
    expect(readiness.status).toBe(200);
    expect(readiness.body.data).toMatchObject({
      ready: false,
      blockers: [{ code: 'CHANNEL_NOT_CONNECTED', network: 'instagram' }],
    });

    const instagram = await seedSocialPage(seed, brandId, { network: 'INSTAGRAM' });
    await api.targets(post.id, [facebook, instagram]);
    expect((await api.attachTestMedia(brandId, post.id)).status).toBe(200);
    expect((await api.readiness(post.id)).body.data.ready).toBe(true);

    const ok = await api.act(post.id, 'schedule', { scheduledAt: inDays(2) });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({
      schedule_state: 'SCHEDULED',
      calendar: { state: 'SCHEDULED' },
      schedule_readiness: { ready: true, blockers: [] },
    });
  });

  it('shows CANNOT_SCHEDULE with a reason when an account disconnects after scheduling', async () => {
    const { seed, brandId, api } = await setup();
    const page = await seedSocialPage(seed, brandId);
    const post = (await api.create(brandId)).body.data;
    await api.targets(post.id, [page]);
    expect((await api.attachTestMedia(brandId, post.id)).status).toBe(200);
    expect((await api.act(post.id, 'schedule', { scheduledAt: inDays(1) })).status).toBe(201);

    await getPrisma().socialPage.update({ where: { id: page }, data: { status: 'NEEDS_REAUTH' } });
    const got = (await api.get(post.id)).body.data;
    expect(got.schedule_state).toBe('SCHEDULED');
    expect(got.calendar.state).toBe('CANNOT_SCHEDULE');
    expect(got.workflow.publishDisplay).toBe('CANNOT_SCHEDULE');
    expect(got.schedule_readiness?.blockers.map((b) => b.code)).toEqual([
      'ACCOUNT_NOT_CONNECTED',
      'NO_CONNECTED_ACCOUNT',
    ]);

    // At publish time the worker skips the post with a visible reason instead of failing silently.
    await getPrisma().contentItem.update({
      where: { id: post.id },
      data: { scheduledAt: new Date(Date.now() - 60_000) },
    });
    const due = await findDuePublishTargetIds(new Date(), Buffer.alloc(32, 1));
    const row = await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.lastPublishSkipReason).toMatch(/not connected/i);
    const targetIds = (
      await getPrisma().contentPublishTarget.findMany({ where: { contentItemId: post.id } })
    ).map((t) => t.id);
    expect(due.ids.filter((id) => targetIds.includes(id))).toEqual([]);
  });

  it('surfaces a scheduled post that has no account at all', async () => {
    const { seed, brandId } = await setup();
    const id = (await seedContentBrandPost(seed.tenantId, brandId, seed.userId)).id;
    await findDuePublishTargetIds(new Date(), Buffer.alloc(32, 1));
    const row = await getPrisma().contentItem.findUniqueOrThrow({ where: { id } });
    expect(row.lastPublishSkipReason).toMatch(/no publishing account/i);
  });

  it('keeps Planned and Scheduled separate', async () => {
    const { seed, brandId, api } = await setup();
    const page = await seedSocialPage(seed, brandId);
    const planned = inDays(3);
    const post = (await api.create(brandId, { plannedAt: planned })).body.data;
    expect(post.calendar).toEqual({ state: 'PLANNED', at: planned });
    expect(post.schedule_state).toBe('UNSCHEDULED');

    await api.targets(post.id, [page]);
    expect((await api.attachTestMedia(brandId, post.id)).status).toBe(200);
    const scheduledAt = inDays(5);
    const scheduled = (await api.act(post.id, 'schedule', { scheduledAt })).body.data;
    expect(scheduled.planned_at).toBe(planned);
    expect(scheduled.calendar.state).toBe('SCHEDULED');

    // Moving the planned date never touches the schedule.
    const moved = (await api.patch(post.id, { plannedAt: inDays(4) })).body.data;
    expect(moved.schedule_state).toBe('SCHEDULED');
    expect(moved.scheduled_at).toBe(scheduled.scheduled_at);

    const listScheduled = (await api.list(brandId, '?calendar_state=scheduled')).body.data;
    expect(listScheduled.map((r) => r.id)).toContain(post.id);
    expect(
      (await api.list(brandId, '?calendar_state=planned')).body.data.map((r) => r.id),
    ).not.toContain(post.id);
    expect((await api.list(brandId, '?calendar_state=bogus')).status).toBe(400);

    // Unscheduling keeps the post on the calendar as Planned.
    const unscheduled = (await api.act(post.id, 'unschedule')).body.data;
    expect(unscheduled.schedule_state).toBe('UNSCHEDULED');
    expect(unscheduled.calendar.state).toBe('PLANNED');

    const bare = (await api.create(brandId)).body.data;
    await api.targets(bare.id, [page]);
    expect((await api.attachTestMedia(brandId, bare.id)).status).toBe(200);
    const at = inDays(6);
    await api.act(bare.id, 'schedule', { scheduledAt: at });
    const back = (await api.act(bare.id, 'unschedule')).body.data;
    expect(back.calendar.state).toBe('PLANNED');
    expect(back.planned_at).not.toBeNull();
  });

  it('schedule-on-approval reports blockers instead of swallowing them', async () => {
    const { brandId, api } = await setup();
    await api.prefs(brandId, { approvalMode: 'required', scheduleOnApproval: true });
    const post = (await api.create(brandId, { plannedAt: inDays(2) })).body.data;
    expect((await api.act(post.id, 'request-approval')).status).toBe(201);
    const approved = await api.act(post.id, 'approve');
    expect(approved.status).toBe(201);
    expect(approved.body.data.approval_state).toBe('APPROVED');
    expect(approved.body.data.schedule_state).toBe('UNSCHEDULED');
    expect(approved.body.auto_schedule).toMatchObject({
      attempted: true,
      scheduled: false,
    });
    expect(approved.body.auto_schedule?.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining(['NO_CONNECTED_ACCOUNT']),
    );
    const row = await getPrisma().contentItem.findUniqueOrThrow({ where: { id: post.id } });
    expect(row.lastPublishSkipReason).toBe('Auto-schedule blocked: NO_CONNECTED_ACCOUNT');
  });
});

async function seedContentBrandPost(tenantId: string, brandId: string, userId: string) {
  return getPrisma().contentItem.create({
    data: {
      id: newId(),
      tenantId,
      brandId,
      titleEn: 'Orphan',
      titleAr: 'يتيم',
      contentType: 'POST',
      channel: 'instagram',
      track: 'ORGANIC',
      status: 'SCHEDULED',
      approvalState: 'APPROVED',
      scheduleState: 'SCHEDULED',
      scheduledAt: new Date(Date.now() - 60_000),
      createdBy: userId,
    },
  });
}
