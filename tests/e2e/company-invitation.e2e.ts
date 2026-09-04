import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { apiPost, cookieHeader, parseCookies, registerBrandOwner } from './helpers/brand-api';

test.describe('Invitation UI', () => {
  test('owner invites; matching member accepts via onboarding', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const inviteEmail = `invitee-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Invitee_1!';

    const invite = await apiPost(request, '/api/v1/tenants/current/invitations', owner.cookies, {
      email: inviteEmail,
    });
    expect(invite.ok(), await invite.text()).toBeTruthy();
    const { invite_token } = await invite.json();

    await page.goto('/register');
    await page.getByLabel('Name').fill('Invitee');
    await page.getByLabel('Email').fill(inviteEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);

    await page.getByRole('button', { name: /join through invitation/i }).click();
    await page.getByLabel(/invitation token/i).fill(invite_token);
    await page.getByRole('button', { name: /accept invitation/i }).click();
    await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /workspace|choose a company/i })).toBeVisible();
  });

  test('wrong email cannot accept invitation', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const inviteEmail = `right-${newId().slice(-8).toLowerCase()}@example.com`;
    const invite = await apiPost(request, '/api/v1/tenants/current/invitations', owner.cookies, {
      email: inviteEmail,
    });
    const { invite_token } = await invite.json();

    const wrongEmail = `wrong-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Wrong_1!';
    await request.post(`${process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001'}/api/v1/auth/register`, {
      data: { email: wrongEmail, password, name: 'Wrong' },
    });
    const login = await request.post(
      `${process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001'}/api/v1/auth/login`,
      { data: { email: wrongEmail, password } },
    );
    const cookies = parseCookies(login);
    const accept = await request.post(
      `${process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001'}/api/v1/invitations/accept`,
      {
        headers: {
          cookie: cookieHeader(cookies),
          'x-csrf-token': cookies.oma_csrf,
        },
        data: { token: invite_token },
      },
    );
    expect(accept.status()).toBe(403);
  });
});
