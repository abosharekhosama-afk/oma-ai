import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();
vi.mock('@oma/db', () => {
  const model = () => ({ count: vi.fn(async () => 0), findMany: (args: unknown) => findMany(args) });
  const prisma = {
    brandWorkspace: model(), campaign: model(), contentItem: model(), workTask: model(),
    workRequest: model(), workDeliverable: model(), contentApprovalEvent: model(), user: model(), contentPreferences: model(),
  };
  return { getPrisma: () => prisma, tenantWhere: (tenantId: string, w: object) => ({ tenantId, ...w }) };
});

import { buildHome, selectAwaitingForUser, summarizeBrands } from '../../apps/api/src/home/home.service';
import { mergePreferences, validatePreferencesPatch } from '../../apps/api/src/account/account.controller';
import {
  bucketWeek, firstName, greetingFor, homeLinks, mapComments, setupProgress, shouldShowSetup,
} from '../../apps/web/src/lib/home-view-model';

const at = (s: string) => new Date(s);

describe('home API: awaiting the current user', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const events = [
    { contentId: 'a', actorUserId: 'sara', action: 'REQUEST', at: at('2026-10-25T08:00:00Z') },
    { contentId: 'b', actorUserId: 'omar', action: 'REQUEST', at: at('2026-10-25T08:00:00Z') },
    { contentId: 'b', actorUserId: 'me', action: 'APPROVE', at: at('2026-10-25T09:00:00Z') },
    // approved before a newer re-request → still awaiting me
    { contentId: 'c', actorUserId: 'me', action: 'APPROVE', at: at('2026-10-20T09:00:00Z') },
    { contentId: 'c', actorUserId: 'lina', action: 'REQUEST', at: at('2026-10-24T09:00:00Z') },
  ];
  it('excludes items I already approved since the latest request and exposes the requester', () => {
    const out = selectAwaitingForUser(items, events, 'me');
    expect(out.map((o) => o.id)).toEqual(['a', 'c']);
    expect(out[0]!.requested_by).toBe('sara');
    expect(out[1]!.requested_by).toBe('lina');
  });
  it('is per user', () => {
    expect(selectAwaitingForUser(items, events, 'someone').map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('home API: brand summaries', () => {
  it('counts awaiting approval and scheduled within the week, with distinct channels', () => {
    const start = at('2026-10-26T00:00:00Z');
    const end = at('2026-11-02T00:00:00Z');
    const rows = [
      { brandId: 'h', channel: 'Instagram', approvalState: 'PENDING', scheduleState: 'UNSCHEDULED', scheduledAt: null },
      { brandId: 'h', channel: 'facebook', approvalState: 'PARTIALLY_APPROVED', scheduleState: 'SCHEDULED', scheduledAt: at('2026-10-27T09:00:00Z') },
      { brandId: 'h', channel: 'instagram', approvalState: 'APPROVED', scheduleState: 'SCHEDULED', scheduledAt: at('2026-11-05T09:00:00Z') },
      { brandId: 'n', channel: 'tiktok', approvalState: 'APPROVED', scheduleState: 'SCHEDULED', scheduledAt: at('2026-10-28T09:00:00Z') },
    ];
    const out = summarizeBrands([{ id: 'h', name: 'Horizon Retail' }, { id: 'n', name: 'Nour Cafe' }], rows, start, end);
    expect(out[0]).toMatchObject({ channels: ['facebook', 'instagram'], awaiting_approval: 2, scheduled_this_week: 1 });
    expect(out[1]).toMatchObject({ channels: ['tiktok'], awaiting_approval: 0, scheduled_this_week: 1 });
  });
});

describe('home API: buildHome permissions', () => {
  it('does not query or return approvals for users without content.approve', async () => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
    const res = await buildHome('t1', 'u1', at('2026-10-26T07:00:00Z'), { canApprove: false });
    expect(res.data.can_approve).toBe(false);
    expect(res.data.awaiting_me).toEqual([]);
    const approvalQueries = findMany.mock.calls.filter(
      ([a]) => JSON.stringify(a).includes('PARTIALLY_APPROVED') && JSON.stringify(a).includes('captionEn'),
    );
    expect(approvalQueries).toHaveLength(0);
    // every query is tenant scoped
    for (const [args] of findMany.mock.calls) {
      const where = (args as { where?: Record<string, unknown> }).where ?? {};
      const scoped = where.tenantId === 't1' || JSON.stringify(where).includes('"id":{"in"');
      expect(scoped).toBe(true);
    }
    expect(res.data.week.items).toEqual([]);
    expect(res.data.brand_summaries).toEqual([]);
  });
});

describe('preferences: home setup dismissal', () => {
  it('defaults to not dismissed and validates the flag', () => {
    expect(mergePreferences('{}').homeSetupDismissed).toBe(false);
    expect(validatePreferencesPatch({ homeSetupDismissed: true })).toEqual({ homeSetupDismissed: true });
    expect(() => validatePreferencesPatch({ homeSetupDismissed: 'yes' })).toThrow();
  });
});

describe('home view model', () => {
  it('greets by time of day and first name', () => {
    expect([greetingFor(6), greetingFor(13), greetingFor(20), greetingFor(2)]).toEqual([
      'morning', 'afternoon', 'evening', 'evening',
    ]);
    expect(firstName('  Osama Abo Sharekh ')).toBe('Osama');
  });
  it('buckets scheduled posts into 7 local days starting today', () => {
    const now = new Date(2026, 9, 26, 9, 0);
    const mk = (id: string, d: Date) => ({
      id, title: { en: id, ar: id }, channel: 'instagram', brand: null,
      scheduled_at: d.toISOString(), thumbnail_url: null, href: `/app/content?item=${id}`,
    });
    const days = bucketWeek(
      [mk('b', new Date(2026, 9, 26, 18)), mk('a', new Date(2026, 9, 26, 10)), mk('c', new Date(2026, 10, 1, 9)), mk('x', new Date(2026, 10, 2, 9))],
      now,
    );
    expect(days).toHaveLength(7);
    expect(days[0]!.isToday).toBe(true);
    expect(days[0]!.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(days[6]!.key).toBe('2026-11-01');
    expect(days[6]!.items.map((i) => i.id)).toEqual(['c']);
    expect(days.flatMap((d) => d.items).some((i) => i.id === 'x')).toBe(false);
  });
  it('hides the setup card when dismissed or complete', () => {
    const steps = [{ id: 'a', done: true, href: '/', count: 1 }, { id: 'b', done: false, href: '/', count: 0 }];
    expect(setupProgress(steps)).toEqual({ done: 1, total: 2, complete: false });
    expect(shouldShowSetup(steps, false)).toBe(true);
    expect(shouldShowSetup(steps, true)).toBe(false);
    expect(shouldShowSetup(steps.map((s) => ({ ...s, done: true })), false)).toBe(false);
  });
  it('maps comment/mention notifications and enriches them from activity', () => {
    const out = mapComments(
      [
        { id: 'n1', type: 'content.comment', deepLinkPath: '/app/content?item=p1', createdAt: '2026-10-26T06:00:00Z', readAt: null },
        { id: 'n2', type: 'task.assigned', deepLinkPath: '/app/tasks', createdAt: '2026-10-26T06:00:00Z', readAt: null },
      ],
      [{
        id: 'a1', at: '2026-10-26T06:00:00Z', action: 'content.comment_added', category: 'content', title: 'Comment', summary: '',
        actor_name: 'Omar Faris',
        target: { type: 'content', name: { en: 'Latte launch', ar: 'إطلاق اللاتيه' }, href: '/app/content?item=p1', snippet: { en: 'Swap image', ar: 'بدّل الصورة' }, snippet_kind: 'comment' },
      }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ actor: 'Omar Faris', unread: true, body: { en: 'Swap image' } });
  });
  it('deep links to the content plan', () => {
    expect(homeLinks.brand('b 1')).toBe('/app/content?view=feed&brand=b%201');
    expect(homeLinks.day('2026-10-27')).toBe('/app/content?view=calendar&date=2026-10-27');
  });
});

describe('home source guards', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../..', p), 'utf8');
  it('uses i18n (no inline isAr) and calm styles (no gradients/glows)', () => {
    for (const f of ['apps/web/src/components/home/home-view.tsx', 'apps/web/src/app/(app)/app/home-client.tsx']) {
      expect(read(f)).not.toMatch(/\bisAr\b/);
    }
    const css = read('apps/web/src/styles/home.css');
    expect(css).not.toMatch(/gradient|glow|text-transform:\s*uppercase/i);
    expect(css).not.toMatch(/margin-left|margin-right|padding-left|padding-right|\bleft:|\bright:/);
  });
});
