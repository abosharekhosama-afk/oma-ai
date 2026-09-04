import { test, expect } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import IORedis from 'ioredis';
import {
  drainRecordedMail,
  RECORDING_MAIL_REDIS_KEY,
} from '../../apps/worker/src/mail/create-mail-adapter';
import {
  apiGet,
  cookieHeader,
  parseCookies,
  registerBrandOwner,
} from './helpers/brand-api';

const API = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

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
    const owner = await registerBrandOwner(request);
    const ownerCookies = { ...owner.cookies };
    const tenantId = owner.tenantId;

    const inv = await request.post(`${API}/api/v1/tenants/current/invitations`, {
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
    expect(notification!.recipientUserId).toBe(owner.userId);

    const notes = await apiGet(request, '/api/v1/notifications', ownerCookies);
    expect(notes.ok(), await notes.text()).toBeTruthy();
    const noteItems = (await notes.json()).items as Array<{ id: string }>;
    expect(noteItems.some((n) => n.id === notification!.id)).toBeTruthy();

    const strangerEmail = `stranger-${newId().toLowerCase()}@example.com`;
    const reg = await request.post(`${API}/api/v1/auth/register`, {
      data: {
        email: strangerEmail,
        password: 'CorrectHorseBattery1!',
        name: 'Stranger',
      },
    });
    expect([200, 201]).toContain(reg.status());
    const strangerLogin = await request.post(`${API}/api/v1/auth/login`, {
      data: { email: strangerEmail, password: 'CorrectHorseBattery1!' },
    });
    expect(strangerLogin.ok()).toBeTruthy();
    const strangerCookies = parseCookies(strangerLogin);
    const deniedNotes = await apiGet(request, '/api/v1/notifications', strangerCookies);
    expect([401, 403, 409]).toContain(deniedNotes.status());

    // Cross-tenant: a different company owner must not see this notification/job.
    const other = await registerBrandOwner(request);
    const otherNotes = await apiGet(request, '/api/v1/notifications', other.cookies);
    expect(otherNotes.ok()).toBeTruthy();
    const otherItems = (await otherNotes.json()).items as Array<{ id: string }>;
    expect(otherItems.some((n) => n.id === notification!.id)).toBeFalsy();

    const otherJob = await apiGet(request, `/api/v1/jobs/${invBody.job_run_id}`, other.cookies);
    expect([403, 404]).toContain(otherJob.status());

    await redis.quit();
  });
});
