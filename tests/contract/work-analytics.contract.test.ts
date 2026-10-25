import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { cookieHeader } from '../helpers/app';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
} from '../helpers/brand-test';

describe('GET /api/v1/analytics (real work analytics)', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let other: Awaited<ReturnType<typeof seedBrandTenant>>;
  let member: Awaited<ReturnType<typeof seedMemberWithoutBrandCaps>>;
  let brandId: string;
  let brand2: string;

  async function call(s: typeof seed, path: string, init?: RequestInit) {
    const res = await fetch(`${s.baseUrl}${path}`, {
      ...init,
      headers: { ...authHeaders(s), ...(init?.headers ?? {}) },
    });
    return { res, body: await res.json().catch(() => ({})) };
  }
  const owner = (p: string, init?: RequestInit) => call(seed, p, init);
  const post = (p: string, body: unknown = {}) =>
    owner(p, { method: 'POST', body: JSON.stringify(body) });

  beforeAll(async () => {
    seed = await seedBrandTenant();
    member = await seedMemberWithoutBrandCaps(seed);
    brandId = (await createBrand(seed, 'Analytics A')).body.data.id;
    brand2 = (await createBrand(seed, 'Analytics B')).body.data.id;

    // Two posts in brand A: one approved after a revision round, one rejected. One draft in B.
    const mk = async (b: string, title: string, plannedAt?: string) => {
      const r = await post(`/api/v1/brands/${b}/content`, {
        title: { en: title, ar: title },
        contentType: 'POST',
        channel: 'instagram',
        ...(plannedAt ? { plannedAt } : {}),
      });
      expect(r.res.status).toBe(201);
      return r.body.data.id as string;
    };
    const past = new Date(Date.now() - 3600_000).toISOString();
    const a1 = await mk(brandId, 'Approved after changes', past);
    const a2 = await mk(brandId, 'Rejected post');
    await mk(brand2, 'Draft in B');
    expect((await post(`/api/v1/content/${a1}/request-approval`)).res.status).toBeLessThan(300);
    expect(
      (await post(`/api/v1/content/${a1}/request-changes`, { note: { en: 'fix', ar: 'عدل' } })).res
        .status,
    ).toBeLessThan(300);
    expect((await post(`/api/v1/content/${a1}/request-approval`)).res.status).toBeLessThan(300);
    expect((await post(`/api/v1/content/${a1}/approve`)).res.status).toBeLessThan(300);
    expect((await post(`/api/v1/content/${a2}/request-approval`)).res.status).toBeLessThan(300);
    expect(
      (await post(`/api/v1/content/${a2}/reject`, { note: { en: 'no', ar: 'لا' } })).res.status,
    ).toBeLessThan(300);

    // Tasks: one done on time by the member, one overdue.
    const task = await post(`/api/v1/brands/${brandId}/tasks`, {
      title: { en: 'Done task', ar: 'منجزة' },
      assigneeUserId: member.userId,
      dueAt: new Date(Date.now() + 86400_000).toISOString(),
      brief: {
        objective: { en: 'o', ar: 'ه' },
        audience: { en: 'a', ar: 'ج' },
        keyMessage: { en: 'm', ar: 'ر' },
      },
    });
    expect(task.res.status).toBe(201);
    const del = await post(`/api/v1/tasks/${task.body.data.id}/convert-to-deliverable`);
    expect(del.res.status).toBe(201);
    const did = del.body.data.id as string;
    for (const action of ['submit', 'request_changes', 'submit', 'approve']) {
      const r = await post(`/api/v1/deliverables/${did}/review`, { action });
      expect(r.res.status, action).toBe(201);
    }
    await getPrisma().workTask.create({
      data: {
        id: newId(),
        tenantId: seed.tenantId,
        brandId,
        titleEn: 'Overdue',
        titleAr: 'متأخرة',
        status: 'IN_PROGRESS',
        dueAt: new Date(Date.now() - 2 * 86400_000),
        createdBy: seed.userId,
      },
    });

    other = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed?.app.close();
    await other?.app.close();
  });

  it('returns content, approval, on-time and team metrics for the tenant', async () => {
    const { res, body } = await owner('/api/v1/analytics?period=30');
    expect(res.status).toBe(200);
    const d = body.data;
    expect(d.range.days).toBe(30);
    expect(d.range.bucket).toBe('day');
    expect(d.content.series).toHaveLength(30);
    expect(d.content.total).toBe(3);
    expect(d.content.by_status.APPROVED).toBe(1);
    expect(d.content.by_status.DRAFT).toBeGreaterThanOrEqual(1);
    expect(d.content.per_brand.map((b: { id: string }) => b.id).sort()).toEqual(
      [brandId, brand2].sort(),
    );
    expect(d.approvals.content).toMatchObject({
      approved: 1,
      rejected: 1,
      changes_requested: 1,
      rejection_rate: 50,
    });
    expect(d.approvals.content.avg_hours_to_approval).not.toBeNull();
    expect(d.approvals.deliverables).toMatchObject({
      approved: 1,
      changes_requested: 1,
      rejected: 0,
      avg_revision_rounds: 1,
    });
    expect(d.on_time.overdue_tasks).toBe(1);
    expect(d.on_time.tasks_completed_with_due).toBe(1);
    expect(d.on_time.task_on_time_rate).toBe(100);
    expect(d.on_time).toMatchObject({
      posts_due: 1,
      posts_approved_on_time: 0,
      post_on_time_rate: 0,
    });
    const m = d.team.find((r: { user_id: string }) => r.user_id === member.userId);
    expect(m).toMatchObject({ tasks_completed: 1, deliverables_approved: 1 });
    const o = d.team.find((r: { user_id: string }) => r.user_id === seed.userId);
    expect(o.approvals_given).toBe(2);
    expect(o.posts_created).toBe(3);
    expect(d.social.connected).toBe(false);
  });

  it('filters by brand and validates brand/campaign/period', async () => {
    const b = await owner(`/api/v1/analytics?period=7&brandId=${brand2}`);
    expect(b.res.status).toBe(200);
    expect(b.body.data.content.total).toBe(1);
    expect(b.body.data.approvals.content.approved).toBe(0);
    expect(b.body.data.on_time.overdue_tasks).toBe(0);
    expect((await owner('/api/v1/analytics?period=12')).res.status).toBe(400);
    expect((await owner('/api/v1/analytics?from=2026-01-10&to=2026-01-01')).res.status).toBe(400);
    expect((await owner('/api/v1/analytics?from=2025-01-01&to=2026-12-31')).res.status).toBe(400);
    expect((await owner('/api/v1/analytics?brandId=nope')).res.status).toBe(404);
    expect((await owner('/api/v1/analytics?campaignId=nope')).res.status).toBe(404);
    const custom = await owner('/api/v1/analytics?from=2026-01-01&to=2026-03-31');
    expect(custom.res.status).toBe(200);
    expect(custom.body.data.range.bucket).toBe('week');
  });

  it('is tenant-isolated: another tenant sees none of this data and cannot use its brand', async () => {
    const r = await call(other, '/api/v1/analytics?period=90');
    expect(r.res.status).toBe(200);
    expect(r.body.data.content.total).toBe(0);
    expect(r.body.data.team.every((t: { user_id: string }) => t.user_id !== member.userId)).toBe(
      true,
    );
    expect((await call(other, `/api/v1/analytics?brandId=${brandId}`)).res.status).toBe(404);
  });

  it('lets a regular member read analytics, and 403s without analytics.read', async () => {
    const headers = {
      'content-type': 'application/json',
      cookie: cookieHeader(member.cookies),
      'x-csrf-token': member.csrf,
    };
    const ok = await fetch(`${seed.baseUrl}/api/v1/analytics`, { headers });
    expect(ok.status).toBe(200);
    await getPrisma().capabilityGrant.updateMany({
      where: { membershipId: member.membershipId, capabilityCode: 'analytics.read' },
      data: { revokedAt: new Date() },
    });
    const denied = await fetch(`${seed.baseUrl}/api/v1/analytics`, { headers });
    expect(denied.status).toBe(403);
    const anon = await fetch(`${seed.baseUrl}/api/v1/analytics`);
    expect(anon.status).toBe(401);
  });
});
