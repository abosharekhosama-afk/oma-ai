import { test, expect } from '@playwright/test';
import { createBrandFlow, registerBrandOwner, registerTenantMember } from './helpers/brand-api';
import { webOrigin } from './helpers/brand-ui';

async function installCookies(
  page: import('@playwright/test').Page,
  cookies: Record<string, string>,
) {
  const origin = webOrigin();
  await page.context().addCookies([
    { name: 'oma_session', value: cookies.oma_session, url: origin },
    { name: 'oma_csrf', value: cookies.oma_csrf, url: origin },
  ]);
}

test.describe('Review collaboration + permission (T130/T131)', () => {
  test('review note and history survive refresh and relogin', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    expect(flow.profileVersionId).toBeTruthy();
    await installCookies(page, owner.cookies);

    const profileUrl = `/app/brands/${flow.brandId}/profiles/${flow.profileVersionId}`;
    await page.goto(profileUrl);
    await expect(page.getByRole('heading', { name: 'Brand intelligence' })).toBeVisible({
      timeout: 30_000,
    });

    const note = `Collab note ${Date.now()}`;
    await page.getByLabel('Review note').fill(note);
    await page.getByRole('button', { name: 'Save note' }).click();
    await expect(page.getByText('Note saved')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Review note')).toHaveValue(note);
    await expect(page.getByRole('heading', { name: /review history/i })).toBeVisible();

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/(login)?$/, { timeout: 15_000 });
    await page.goto('/login');
    await page.getByLabel('Email').fill(owner.email);
    await page.getByLabel('Password').fill(owner.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });
    await page.goto(profileUrl);
    await expect(page.getByLabel('Review note')).toHaveValue(note);
  });

  test('invited member without brand caps sees permission denied', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    const member = await registerTenantMember(request, owner, []);

    await installCookies(page, member.cookies);
    await page.goto(`/app/brands/${flow.brandId}`);
    await expect(page.getByRole('heading', { name: /permission denied/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/do not have permission/i)).toBeVisible();
  });
});
