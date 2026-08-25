import { config as loadDotenv } from 'dotenv';
import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import IORedis from 'ioredis';
import {
  drainRecordedMail,
  RECORDING_MAIL_REDIS_KEY,
} from '../../apps/worker/src/mail/create-mail-adapter';

loadDotenv();

function parseCookies(res: APIResponse): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { name, value } of res.headersArray()) {
    if (name.toLowerCase() !== 'set-cookie') continue;
    const [pair] = value.split(';');
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    out[pair.slice(0, eq).trim()] = decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return out;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
}

async function login(request: APIRequestContext, email: string, password: string) {
  const res = await request.post('http://127.0.0.1:3001/api/v1/auth/login', {
    data: { email, password },
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return parseCookies(res);
}

test.describe('T077 invite → mail job → notification', () => {
  test('authorized invite persists outbox, worker sends via mail port, notification readable; unauthorized denied', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');

    const redis = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
    });
    await redis.del(RECORDING_MAIL_REDIS_KEY);

    const prisma = getPrisma();
    const correlationId = `e2e-corr-${newId()}`;
    const inviteEmail = `invitee-${newId().toLowerCase()}@example.com`;
    const ownerEmail = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL ?? 'platform-owner@example.com';
    const ownerPassword =
      process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD ?? 'ChangeMe_PlatformOwner_1!';

    const ownerCookies = await login(request, ownerEmail, ownerPassword);

    const slug = `e2e-${newId().toLowerCase().slice(-8)}`;
    const created = await request.post('http://127.0.0.1:3001/api/v1/tenants', {
      headers: {
        cookie: cookieHeader(ownerCookies),
        'x-csrf-token': ownerCookies.oma_csrf,
        'x-correlation-id': correlationId,
      },
      data: { name: 'E2E Co', slug },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const tenantId = (await created.json()).tenant.id as string;

    const switched = await request.post('http://127.0.0.1:3001/api/v1/tenants/active', {
      headers: {
        cookie: cookieHeader(ownerCookies),
        'x-csrf-token': ownerCookies.oma_csrf,
        'x-correlation-id': correlationId,
      },
      data: { tenant_id: tenantId },
    });
    expect(switched.ok(), await switched.text()).toBeTruthy();
    Object.assign(ownerCookies, parseCookies(switched));

    const inv = await request.post('http://127.0.0.1:3001/api/v1/tenants/current/invitations', {
      headers: {
        cookie: cookieHeader(ownerCookies),
        'x-csrf-token': ownerCookies.oma_csrf,
        'x-correlation-id': correlationId,
        'idempotency-key': `e2e-invite-${newId()}`,
      },
      data: { email: inviteEmail },
    });
    expect(inv.ok(), await inv.text()).toBeTruthy();
    expect(inv.headers()['x-correlation-id']).toBe(correlationId);
    const invBody = await inv.json();
    expect(invBody.membership_id).toBeTruthy();
    expect(invBody.job_run_id).toBeTruthy();

    const membership = await prisma.membership.findUniqueOrThrow({
      where: { id: invBody.membership_id },
    });
    expect(membership.tenantId).toBe(tenantId);
    expect(membership.invitedEmail).toBe(inviteEmail);

    const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: invBody.job_run_id } });
    expect(jobRun.tenantId).toBe(tenantId);
    expect(jobRun.correlationId).toBe(correlationId);
    expect(jobRun.queue).toBe('mail');

    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        tenantId,
        eventType: 'mail.invite',
        payloadJson: { contains: invBody.job_run_id },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox).toBeTruthy();

    let terminal = jobRun;
    for (let i = 0; i < 40; i++) {
      terminal = await prisma.jobRun.findUniqueOrThrow({ where: { id: invBody.job_run_id } });
      if (terminal.status === 'SUCCEEDED' || terminal.status === 'DEAD') break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(terminal.status, `job status=${terminal.status} err=${terminal.errorCode}`).toBe(
      'SUCCEEDED',
    );

    const published = await prisma.outboxEvent.findFirst({
      where: {
        tenantId,
        eventType: 'mail.invite',
        payloadJson: { contains: invBody.job_run_id },
      },
    });
    expect(published?.status).toBe('PUBLISHED');

    const sent = await drainRecordedMail(redis);
    expect(sent.some((m) => m.to === inviteEmail)).toBeTruthy();

    const notification = await prisma.notification.findFirst({
      where: { tenantId, dedupeKey: { startsWith: `${invBody.job_run_id}:` } },
    });
    expect(notification).toBeTruthy();

    const me = await request.get('http://127.0.0.1:3001/api/v1/auth/me', {
      headers: { cookie: cookieHeader(ownerCookies) },
    });
    expect(me.ok()).toBeTruthy();
    const meBody = await me.json();
    const ownerUserId = meBody.user?.id as string;
    expect(notification!.recipientUserId).toBe(ownerUserId);

    const notes = await request.get('http://127.0.0.1:3001/api/v1/notifications', {
      headers: { cookie: cookieHeader(ownerCookies) },
    });
    expect(notes.ok(), await notes.text()).toBeTruthy();
    const noteItems = (await notes.json()).items as Array<{ id: string }>;
    expect(noteItems.some((n) => n.id === notification!.id)).toBeTruthy();

    const strangerEmail = `stranger-${newId().toLowerCase()}@example.com`;
    const reg = await request.post('http://127.0.0.1:3001/api/v1/auth/register', {
      data: {
        email: strangerEmail,
        password: 'CorrectHorseBattery1!',
        name: 'Stranger',
      },
    });
    expect([200, 201]).toContain(reg.status());
    const strangerCookies = await login(request, strangerEmail, 'CorrectHorseBattery1!');
    const deniedNotes = await request.get('http://127.0.0.1:3001/api/v1/notifications', {
      headers: { cookie: cookieHeader(strangerCookies) },
    });
    expect([401, 403, 409]).toContain(deniedNotes.status());

    const otherCookies = await login(request, ownerEmail, ownerPassword);
    const otherSlug = `other-${newId().toLowerCase().slice(-8)}`;
    const otherTenantRes = await request.post('http://127.0.0.1:3001/api/v1/tenants', {
      headers: {
        cookie: cookieHeader(otherCookies),
        'x-csrf-token': otherCookies.oma_csrf,
      },
      data: { name: 'Other', slug: otherSlug },
    });
    expect(otherTenantRes.ok(), await otherTenantRes.text()).toBeTruthy();
    const otherTenantId = (await otherTenantRes.json()).tenant.id as string;
    const otherSwitch = await request.post('http://127.0.0.1:3001/api/v1/tenants/active', {
      headers: {
        cookie: cookieHeader(otherCookies),
        'x-csrf-token': otherCookies.oma_csrf,
      },
      data: { tenant_id: otherTenantId },
    });
    expect(otherSwitch.ok()).toBeTruthy();
    Object.assign(otherCookies, parseCookies(otherSwitch));

    const otherNotes = await request.get('http://127.0.0.1:3001/api/v1/notifications', {
      headers: { cookie: cookieHeader(otherCookies) },
    });
    expect(otherNotes.ok()).toBeTruthy();
    const otherItems = (await otherNotes.json()).items as Array<{ id: string }>;
    expect(otherItems.some((n) => n.id === notification!.id)).toBeFalsy();

    const otherJob = await request.get(`http://127.0.0.1:3001/api/v1/jobs/${invBody.job_run_id}`, {
      headers: { cookie: cookieHeader(otherCookies) },
    });
    expect([403, 404]).toContain(otherJob.status());

    await redis.quit();
  });
});
