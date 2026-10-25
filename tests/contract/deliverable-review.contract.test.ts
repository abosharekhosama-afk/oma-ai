import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@oma/domain';
import { cookieHeader, parseCookies } from '../helpers/app';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
} from '../helpers/brand-test';

describe('deliverable review production lock', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let brandId: string;
  let approvedId: string;
  let changesId: string;
  let annotationId: string;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    const brand = await createBrand(seed, 'Lock Brand');
    expect(brand.res.status).toBe(201);
    brandId = brand.body.data.id as string;
  });

  afterAll(async () => {
    await seed?.app.close();
  });

  async function api(path: string, init?: RequestInit & { csrf?: boolean }) {
    const headers = authHeaders(seed);
    if (init?.csrf === false) delete (headers as { 'x-csrf-token'?: string })['x-csrf-token'];
    const res = await fetch(`${seed.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  }

  async function newDeliverable() {
    const created = await api(`/api/v1/brands/${brandId}/requests`, {
      method: 'POST',
      body: JSON.stringify({
        title: { en: `Lock request ${newId().slice(-6)}`, ar: 'طلب' },
        brief: {
          objective: { en: 'Objective', ar: 'هدف' },
          audience: { en: 'Audience', ar: 'جمهور' },
          keyMessage: { en: 'Message', ar: 'رسالة' },
        },
      }),
    });
    expect(created.res.status).toBe(201);
    const requestId = created.body.data.id as string;
    expect(created.body.data.brief.ready).toBe(true);
    const task = await api(`/api/v1/requests/${requestId}/convert-to-task`, { method: 'POST' });
    expect(task.res.status).toBe(201);
    const deliverable = await api(`/api/v1/tasks/${task.body.data.id}/convert-to-deliverable`, {
      method: 'POST',
    });
    expect(deliverable.res.status).toBe(201);
    return deliverable.body.data.id as string;
  }

  it('blocks convert-to-task until the brief is ready', async () => {
    const created = await api(`/api/v1/brands/${brandId}/requests`, {
      method: 'POST',
      body: JSON.stringify({ title: { en: 'Incomplete brief', ar: 'ناقص' } }),
    });
    expect(created.res.status).toBe(201);
    expect(created.body.data.brief.ready).toBe(false);
    const blocked = await api(`/api/v1/requests/${created.body.data.id}/convert-to-task`, {
      method: 'POST',
    });
    expect(blocked.res.status).toBe(409);
    expect(blocked.body.error.code).toBe('CONFLICT_STATE');
    expect(String(blocked.body.error.message)).toContain('BRIEF_NOT_READY');
  });

  it('submits a draft and pins approval to the current version', async () => {
    approvedId = await newDeliverable();
    const submitted = await api(`/api/v1/deliverables/${approvedId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'submit' }),
    });
    expect(submitted.res.status).toBe(201);
    expect(submitted.body.data.review_status).toBe('AWAITING_REVIEW');

    const note = await api(`/api/v1/deliverables/${approvedId}/annotations`, {
      method: 'POST',
      body: JSON.stringify({ body: { en: 'Check the crop', ar: 'تحقق' }, x: 0.2, y: 0.3 }),
    });
    expect(note.res.status).toBe(201);
    annotationId = note.body.data.id as string;

    const approved = await api(`/api/v1/deliverables/${approvedId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(approved.res.status).toBe(201);
    expect(approved.body.data.review_status).toBe('APPROVED');
    expect(approved.body.data.approved_version_id).toBeTruthy();

    const detail = await api(`/api/v1/deliverables/${approvedId}`);
    expect(detail.res.status).toBe(200);
    expect(detail.body.data.approved_version_id).toBe(approved.body.data.approved_version_id);
    const pinned = (
      detail.body.versions as Array<{ id: string; status: string; immutable: boolean }>
    ).find((v) => v.id === detail.body.data.approved_version_id);
    expect(pinned?.status).toBe('APPROVED');
    expect(pinned?.immutable).toBe(true);
  });

  it('rejects a second approve and a version on an approved deliverable', async () => {
    const again = await api(`/api/v1/deliverables/${approvedId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(again.res.status).toBe(409);
    expect(again.body.error.code).toBe('CONFLICT_STATE');

    const version = await api(`/api/v1/deliverables/${approvedId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label: 'v2' }),
    });
    expect(version.res.status).toBe(409);
    expect(version.body.error.code).toBe('CONFLICT_STATE');
  });

  it('rejects new annotations on an approved deliverable and still resolves existing ones', async () => {
    const denied = await api(`/api/v1/deliverables/${approvedId}/annotations`, {
      method: 'POST',
      body: JSON.stringify({ body: { en: 'Too late', ar: 'متأخر' } }),
    });
    expect(denied.res.status).toBe(409);

    const resolved = await api(`/api/v1/deliverable-annotations/${annotationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved: true }),
    });
    expect(resolved.res.status).toBe(200);
    expect(resolved.body.data.resolved).toBe(true);
  });

  it('allows a version after request_changes and keeps that review status', async () => {
    changesId = await newDeliverable();
    const submitted = await api(`/api/v1/deliverables/${changesId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'submit' }),
    });
    expect(submitted.res.status).toBe(201);
    const changes = await api(`/api/v1/deliverables/${changesId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'request_changes' }),
    });
    expect(changes.res.status).toBe(201);
    expect(changes.body.data.review_status).toBe('CHANGES_REQUESTED');
    const version = await api(`/api/v1/deliverables/${changesId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label: 'revision' }),
    });
    expect(version.res.status).toBe(201);
    expect(version.body.data.review_status).toBe('CHANGES_REQUESTED');
    expect(version.body.data.approved_version_id).toBeNull();
  });

  it('denies decide without deliverable.review.decide', async () => {
    const member = await seedMemberWithoutBrandCaps(seed);
    const headers = {
      'content-type': 'application/json',
      cookie: cookieHeader(member.cookies),
      'x-csrf-token': member.csrf,
    };
    const res = await fetch(`${seed.baseUrl}/api/v1/deliverables/${changesId}/review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('PERMISSION_DENIED');
  });

  it('hides deliverables from another tenant', async () => {
    const email = `other-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_OtherOwner_1!';
    const register = await fetch(`${seed.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Other Owner' }),
    });
    expect(register.ok).toBe(true);
    const login = await fetch(`${seed.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const cookies = parseCookies(login);
    const csrf = cookies[process.env.CSRF_COOKIE_NAME ?? 'oma_csrf'];
    const tenantRes = await fetch(`${seed.baseUrl}/api/v1/tenants`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({ name: 'Other Co', slug: `other-${newId().slice(-6).toLowerCase()}` }),
    });
    expect(tenantRes.ok).toBe(true);
    const tenantBody = (await tenantRes.json()) as { tenant: { id: string } };
    const switched = await fetch(`${seed.baseUrl}/api/v1/tenants/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({ tenant_id: tenantBody.tenant.id }),
    });
    expect(switched.ok).toBe(true);
    Object.assign(cookies, parseCookies(switched));
    const res = await fetch(`${seed.baseUrl}/api/v1/deliverables/${approvedId}`, {
      headers: { cookie: cookieHeader(cookies) },
    });
    expect([403, 404]).toContain(res.status);
  });

  it('requires CSRF on review mutations', async () => {
    const res = await fetch(`${seed.baseUrl}/api/v1/deliverables/${changesId}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: authHeaders(seed).cookie },
      body: JSON.stringify({ action: 'submit' }),
    });
    expect(res.status).toBe(403);
  });

  it('writes audit events for approve and addVersion', async () => {
    const audit = await api('/api/v1/audit-events?limit=100');
    expect(audit.res.status).toBe(200);
    const actions = (
      audit.body.items as Array<{ action: string; targetId: string; afterRef?: string }>
    ).map((row) => row.action);
    expect(actions).toContain('deliverable.review.approve');
    expect(actions).toContain('deliverable.version.added');
    const approve = (
      audit.body.items as Array<{ action: string; targetId: string; afterRef?: string | null }>
    ).find((row) => row.action === 'deliverable.review.approve' && row.targetId === approvedId);
    expect(approve?.afterRef).toBeTruthy();
  });

  it('rejects an in-review deliverable (persists REJECTED, blocks the task, locks versions)', async () => {
    const id = await newDeliverable();
    const submitted = await api(`/api/v1/deliverables/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'submit' }),
    });
    expect(submitted.res.status).toBe(201);
    const rejected = await api(`/api/v1/deliverables/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reject' }),
    });
    expect(rejected.res.status).toBe(201);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect(rejected.body.data.review_status).toBe('REJECTED');
    const taskId = rejected.body.data.task_id as string;
    const task = await api(`/api/v1/tasks/${taskId}`);
    expect(task.body.data.status).toBe('BLOCKED');
    const again = await api(`/api/v1/deliverables/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(again.res.status).toBe(409);
    const version = await api(`/api/v1/deliverables/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label: 'v2' }),
    });
    expect(version.res.status).toBe(409);
  });
});
