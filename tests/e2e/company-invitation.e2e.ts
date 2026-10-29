import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { apiPost, cookieHeader, parseCookies, registerBrandOwner } from './helpers/brand-api';

test.describe('Invitation UI', () => {
  test('legacy invitation links redirect to the standalone page before login', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');

    for (const legacyUrl of [
      '/app/onboarding?invite=legacy-token',
      '/app/invite?token=legacy-token',
    ]) {
      await page.goto(legacyUrl);
      await expect(page).toHaveURL(/\/invite\?token=legacy-token$/);
      await expect(page.getByTestId('invite-acceptance')).toBeVisible();
      await expect(page.getByTestId('shell-invite-members')).toHaveCount(0);
    }
  });

  test('new member creates an account and accepts on a standalone page', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const inviteEmail = `invitee-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Invitee_1!';

    const invite = await apiPost(request, '/api/v1/tenants/current/invitations', owner.cookies, {
      email: inviteEmail,
    });
    expect(invite.ok(), await invite.text()).toBeTruthy();
    const { invite_token } = await invite.json();

    await page.goto(`/invite?token=${encodeURIComponent(invite_token)}`);
    await expect(page.getByTestId('invite-acceptance')).toBeVisible();
    await expect(page.getByTestId('shell-invite-members')).toHaveCount(0);
    await page.getByLabel(/name/i).fill('Invitee');
    await page.getByLabel(/email/i).fill(inviteEmail);
    await page.getByLabel(/create a password/i).fill(password);
    await page.getByRole('button', { name: /accept invitation/i }).click();
    await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 20_000 });
    await expect(
      page.getByRole('heading', { name: /command center|workspace|choose a company/i }),
    ).toBeVisible();
  });

  test('existing member signs in and accepts on a standalone page', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const email = `existing-invitee-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Existing_1!';
    const apiBase = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';
    const registration = await request.post(`${apiBase}/api/v1/auth/register`, {
      data: { email, password, name: 'Existing invitee' },
    });
    expect(registration.ok(), await registration.text()).toBeTruthy();
    const invite = await apiPost(request, '/api/v1/tenants/current/invitations', owner.cookies, {
      email,
    });
    expect(invite.ok(), await invite.text()).toBeTruthy();
    const { invite_token } = await invite.json();

    await page.goto(`/invite?token=${encodeURIComponent(invite_token)}`);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/enter your password/i).fill(password);
    await page
      .getByRole('button', { name: /log in/i })
      .last()
      .click();
    await expect(page).toHaveURL(/\/app(\/|$)/, { timeout: 20_000 });
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
    await request.post(
      `${process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001'}/api/v1/auth/register`,
      {
        data: { email: wrongEmail, password, name: 'Wrong' },
      },
    );
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
