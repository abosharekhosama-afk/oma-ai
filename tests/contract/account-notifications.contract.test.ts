import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { cookieHeader } from '../helpers/app';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
  addBrandMember,
} from '../helpers/brand-test';

describe('account, preferences and real notifications', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let member: Awaited<ReturnType<typeof seedMemberWithoutBrandCaps>>;
  let brandId: string;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    member = await seedMemberWithoutBrandCaps(seed);
    const brand = await createBrand(seed, 'Notif Brand');
    expect(brand.res.status).toBe(201);
    brandId = brand.body.data.id as string;
    // Per-brand access: the member works on this brand.
    await addBrandMember(seed.tenantId, brandId, member.userId, 'EDITOR');
  });

  afterAll(async () => {
    await seed?.app.close();
  });

  async function asOwner(path: string, init?: RequestInit) {
    const res = await fetch(`${seed.baseUrl}${path}`, {
      ...init,
      headers: { ...authHeaders(seed), ...(init?.headers ?? {}) },
    });
    return { res, body: await res.json().catch(() => ({})) };
  }
  async function asMember(path: string, init?: RequestInit) {
    const res = await fetch(`${seed.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(member.cookies),
        'x-csrf-token': member.csrf,
        ...(init?.headers ?? {}),
      },
    });
    return { res, body: await res.json().catch(() => ({})) };
  }
  async function memberNotifs() {
    const r = await asMember('/api/v1/notifications');
    expect(r.res.status).toBe(200);
    return r.body.items as Array<{
      id: string;
      type: string;
      readAt: string | null;
      deepLinkPath: string;
    }>;
  }

  it('reads and saves per-user preferences without capability 403 (member)', async () => {
    const get = await asMember('/api/v1/me/preferences');
    expect(get.res.status).toBe(200);
    expect(get.body.data.weekStart).toBeDefined();
    const patch = await asMember('/api/v1/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ weekStart: 'sunday', notifications: { 'task.comment': false } }),
    });
    expect(patch.res.status).toBe(200);
    expect(patch.body.data.weekStart).toBe('sunday');
    expect(patch.body.data.notifications['task.comment']).toBe(false);
    const bad = await asMember('/api/v1/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ weekStart: 'friday' }),
    });
    expect(bad.res.status).toBe(400);
  });

  it('updates profile name, avatar and language server-side', async () => {
    const patch = await asMember('/api/v1/me/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Mona',
        avatarUrl: 'https://example.com/a.png',
        preferredLocale: 'ar',
      }),
    });
    expect(patch.res.status).toBe(200);
    expect(patch.body.data).toMatchObject({
      name: 'Mona',
      avatar_url: 'https://example.com/a.png',
      preferred_locale: 'ar',
    });
    const bad = await asMember('/api/v1/me/profile', {
      method: 'PATCH',
      body: JSON.stringify({ avatarUrl: 'javascript:alert(1)' }),
    });
    expect(bad.res.status).toBe(400);
    const me = await asMember('/api/v1/auth/me');
    expect(me.body.user.avatar_url ?? me.body.data?.user?.avatar_url).toBe(
      'https://example.com/a.png',
    );
  });

  it('refreshes the session and returns a later expiry', async () => {
    const r = await asMember('/api/v1/auth/session/refresh', { method: 'POST', body: '{}' });
    expect(r.res.status).toBe(200);
    expect(Date.parse(r.body.data.expires_at)).toBeGreaterThan(Date.now());
  });

  let taskId: string;
  it('notifies the assignee when a task is assigned, not the actor', async () => {
    const created = await asOwner(`/api/v1/brands/${brandId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: { en: 'Notify me', ar: 'أشعرني' },
        assigneeUserId: member.userId,
        brief: {
          objective: { en: 'O', ar: 'ه' },
          audience: { en: 'A', ar: 'ج' },
          keyMessage: { en: 'M', ar: 'ر' },
        },
      }),
    });
    expect(created.res.status).toBe(201);
    taskId = created.body.data.id as string;
    const items = await memberNotifs();
    const n = items.find((i) => i.type === 'task.assigned');
    expect(n).toBeTruthy();
    expect(n!.deepLinkPath).toContain(taskId);
    const ownerSide = await getPrisma().notification.count({
      where: { recipientUserId: seed.userId, type: 'task.assigned', objectId: taskId },
    });
    expect(ownerSide).toBe(0);
  });

  it('notifies the task creator on a comment; respects the opt-out of the member', async () => {
    const c = await asMember(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: { en: 'On it', ar: 'حاضر' } }),
    });
    expect(c.res.status).toBe(201);
    const ownerCount = await getPrisma().notification.count({
      where: { recipientUserId: seed.userId, type: 'task.comment', objectId: taskId },
    });
    expect(ownerCount).toBe(1);
    // Member opted out of task.comment above → owner's reply does not notify them.
    const c2 = await asOwner(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: { en: 'Thanks', ar: 'شكرا' } }),
    });
    expect(c2.res.status).toBe(201);
    const memberCount = await getPrisma().notification.count({
      where: { recipientUserId: member.userId, type: 'task.comment', objectId: taskId },
    });
    expect(memberCount).toBe(0);
  });

  it('notifies the assignee on deliverable submit and reject', async () => {
    const d = await asOwner(`/api/v1/tasks/${taskId}/convert-to-deliverable`, { method: 'POST' });
    expect(d.res.status).toBe(201);
    const id = d.body.data.id as string;
    const s = await asOwner(`/api/v1/deliverables/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'submit' }),
    });
    expect(s.res.status).toBe(201);
    const r = await asOwner(`/api/v1/deliverables/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reject' }),
    });
    expect(r.res.status).toBe(201);
    const types = (await memberNotifs())
      .filter((n) => n.deepLinkPath.includes(id))
      .map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['deliverable.review', 'deliverable.rejected']));
  });

  it('marks a single notification and then all as read', async () => {
    const items = await memberNotifs();
    const first = items.find((i) => !i.readAt)!;
    const one = await asMember(`/api/v1/notifications/${first.id}/read`, {
      method: 'POST',
      body: '{}',
    });
    expect([200, 201]).toContain(one.res.status);
    const after = await memberNotifs();
    expect(after.find((i) => i.id === first.id)!.readAt).toBeTruthy();
    const all = await asMember('/api/v1/notifications/read-all', { method: 'POST', body: '{}' });
    expect([200, 201]).toContain(all.res.status);
    expect((await memberNotifs()).every((i) => i.readAt)).toBe(true);
  });

  it('accepts a password reset request without revealing whether the email exists', async () => {
    const r = await fetch(`${seed.baseUrl}/api/v1/auth/recovery/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    expect([200, 201]).toContain(r.status);
  });
});
