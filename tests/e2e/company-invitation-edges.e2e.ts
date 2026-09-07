import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { getPrisma } from '@oma/db';
import {
  apiPost,
  cookieHeader,
  parseCookies,
  registerBrandOwner,
  registerTenantMember,
} from './helpers/brand-api';

const API = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

test.describe('Invitation edge cases', () => {
  test('expired invitation cannot be accepted', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const inviteEmail = `expired-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Expired_1!';

    const invite = await apiPost(request, '/api/v1/tenants/current/invitations', owner.cookies, {
      email: inviteEmail,
    });
    expect(invite.ok()).toBeTruthy();
    const { invite_token, membership_id } = await invite.json();

    const prisma = getPrisma();
    const invitation = await prisma.invitation.findFirstOrThrow({
      where: { membershipId: membership_id },
    });
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request.post(`${API}/api/v1/auth/register`, {
      data: { email: inviteEmail, password, name: 'Expired' },
    });
    const login = await request.post(`${API}/api/v1/auth/login`, {
      data: { email: inviteEmail, password },
    });
    const cookies = parseCookies(login);
    const accept = await request.post(`${API}/api/v1/invitations/accept`, {
      headers: {
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      data: { token: invite_token },
    });
    expect(accept.status()).toBe(404);
  });

  test('reused invitation cannot be accepted twice', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const inviteEmail = `reuse-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Reuse_1!';

    const invite = await apiPost(request, '/api/v1/tenants/current/invitations', owner.cookies, {
      email: inviteEmail,
    });
    const { invite_token } = await invite.json();

    await request.post(`${API}/api/v1/auth/register`, {
      data: { email: inviteEmail, password, name: 'Reuse' },
    });
    const login = await request.post(`${API}/api/v1/auth/login`, {
      data: { email: inviteEmail, password },
    });
    const cookies = parseCookies(login);
    const first = await request.post(`${API}/api/v1/invitations/accept`, {
      headers: {
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      data: { token: invite_token },
    });
    expect(first.ok()).toBeTruthy();

    const second = await request.post(`${API}/api/v1/invitations/accept`, {
      headers: {
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      data: { token: invite_token },
    });
    expect(second.status()).toBe(404);
  });

  test('member without invite capability cannot create invitations', async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const member = await registerTenantMember(request, owner, []);
    const denied = await apiPost(request, '/api/v1/tenants/current/invitations', member.cookies, {
      email: `nobody-${newId().slice(-6)}@example.com`,
    });
    expect(denied.status()).toBe(403);
  });
});
