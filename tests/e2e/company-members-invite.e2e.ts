import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { registerBrandOwner } from './helpers/brand-api';
import { webOrigin } from './helpers/brand-ui';

test.describe('Company members invitation UI', () => {
  test('owner creates invitation and copies secure link from members page', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const origin = webOrigin();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);

    await page.goto('/app/company/members');
    await expect(page.getByRole('heading', { name: /members|company/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    const inviteEmail = `ui-invite-${newId().slice(-8).toLowerCase()}@example.com`;
    await page.getByLabel(/email/i).fill(inviteEmail);
    await page.getByRole('button', { name: /create invitation/i }).click();
    await expect(page.locator('code.oma-code-block')).toContainText('/app/onboarding?invite=', {
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /copy invitation link/i }).click();
    await expect(page.getByRole('button', { name: /^copied$/i })).toBeVisible({ timeout: 10_000 });
  });
});
