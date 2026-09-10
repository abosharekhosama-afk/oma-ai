import { test, expect } from '@playwright/test';
import { createBrandFlow, registerBrandOwner } from './helpers/brand-api';

const BLOCKED_HOSTS =
  /facebook\.com|graph\.facebook|meta\.com|tiktok\.com|googleapis\.com|openai\.com|anthropic\.com|semrush\.com|smartly\.io|workdrive|zoho\.com/i;

async function loginAsOwner(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
) {
  let email = process.env.OMA_REVIEW_OWNER_EMAIL;
  let password = process.env.OMA_REVIEW_OWNER_PASSWORD;
  if (!email || !password) {
    const owner = await registerBrandOwner(request);
    await createBrandFlow(request, owner.cookies);
    email = owner.email;
    password = owner.password;
  }
  await page.goto('/login');
  await page.getByLabel(/email|البريد/i).fill(email);
  await page.getByLabel(/password|كلمة/i).fill(password);
  await page.getByRole('button', { name: /sign in|تسجيل/i }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });
}

test.describe('Complete product demo journey', () => {
  test('navigates shell areas with linked demo entities', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'primary journey on en-desktop');

    const consoleErrors: string[] = [];
    const blockedRequests: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('request', (req) => {
      if (BLOCKED_HOSTS.test(req.url())) blockedRequests.push(req.url());
    });

    await loginAsOwner(page, request);

    await expect(page.getByTestId('product-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-command-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('demo-disclosure').first()).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^campaigns$/i })
      .click();
    await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Summer Organic Always-On/i)).toBeVisible();
    await page.getByRole('link', { name: /Summer Organic Always-On/i }).click();
    await expect(page).toHaveURL(/\/app\/campaigns\/demo-campaign-organic/);
    await expect(page.getByTestId('demo-campaign-detail')).toBeVisible();
    await expect(page.getByTestId('demo-strategy-id')).toHaveText(/demo-strategy-q3/);

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /content/i })
      .click();
    await expect(page.getByTestId('demo-content')).toBeVisible();
    await expect(
      page.getByText(/Fabric story carousel|Studio morning reel/i).first(),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^requests$/i })
      .click();
    await expect(page.getByTestId('demo-requests')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^tasks$/i })
      .click();
    await expect(page.getByTestId('demo-tasks')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^deliverables$/i })
      .click();
    await expect(page.getByTestId('demo-deliverables')).toBeVisible();
    await page
      .getByRole('link', { name: /carousel|fabric/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/deliverables\/demo-deliv-/);
    await expect(page.getByTestId('demo-deliverable-detail')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^reviews$/i })
      .click();
    await expect(page.getByTestId('demo-reviews')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^schedule$/i })
      .click();
    await expect(page.getByTestId('demo-schedule')).toBeVisible();
    await expect(page.getByText(/not connected|publishing/i).first()).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^analytics$/i })
      .click();
    await expect(page.getByTestId('demo-analytics')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^team$/i })
      .click();
    await expect(page.getByTestId('demo-team')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^activity$/i })
      .click();
    await expect(page.getByTestId('demo-activity')).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^settings$/i })
      .click();
    await expect(page.getByTestId('demo-integrations')).toBeVisible();
    await expect(
      page.getByText(/Not Connected|Deferred|NOT_CONNECTED|DEFERRED/i).first(),
    ).toBeVisible();

    expect(blockedRequests).toEqual([]);
    const serious = consoleErrors.filter(
      (e) => !/favicon|React DevTools|Download the React/i.test(e),
    );
    expect(serious).toEqual([]);
  });

  test('Arabic RTL demo campaigns', async ({ page, request, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'ar-desktop', 'Arabic project only');
    await context.addCookies([{ name: 'oma_locale', value: 'ar', url: 'http://127.0.0.1:3000' }]);
    await loginAsOwner(page, request);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /الحملات|campaigns/i })
      .click();
    await expect(page.getByTestId('demo-campaigns')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/هورايزون|عضوية|حملة/i).first()).toBeVisible();
  });

  test('tablet and mobile shell reach demo tasks', async ({ page, request }, testInfo) => {
    test.skip(
      !['en-tablet', 'en-mobile'].includes(testInfo.project.name),
      'viewport projects only',
    );
    await loginAsOwner(page, request);
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^tasks$/i })
      .click();
    await expect(page.getByTestId('demo-tasks')).toBeVisible({ timeout: 15_000 });
  });
});
