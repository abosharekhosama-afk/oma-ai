import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { getPrisma } from '@oma/db';
import { trackE2eTenant } from './helpers/brand-api';
import { signOutUi } from './helpers/brand-ui';

/**
 * T163: login form → company selector → create brand form → overview.
 * No installOwnerSession, no apiPost brand create, no page.evaluate activate.
 */
test.describe('Brand UI entry journey', () => {
  test('login selects company then creates brand through the UI', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const email = `entry-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Entry_1!';
    const companyA = `Alpha Entry ${newId().slice(-4)}`;
    const companyB = `Beta Entry ${newId().slice(-4)}`;

    await page.goto('/register');
    await page.getByLabel('Name').fill('Entry User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /create a company/i }).click();
    await page.getByLabel(/company name/i).fill(companyA);
    await page.getByRole('button', { name: /^create company$/i }).click();
    await expect(page.getByTestId('product-home')).toBeVisible({
      timeout: 20_000,
    });

    // Second membership so next login must use selector (not auto-activate sole membership).
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const second = await prisma.tenant.create({
      data: {
        id: newId(),
        name: companyB,
        slug: `beta-${newId().slice(-8).toLowerCase()}`,
        status: 'ACTIVE',
      },
    });
    trackE2eTenant(second.id);
    await prisma.membership.create({
      data: {
        id: newId(),
        tenantId: second.id,
        userId: user.id,
        status: 'ACTIVE',
      },
    });
    // Clear active tenant so login lands on selector
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { activeTenantId: null },
    });

    await signOutUi(page);
    if (!page.url().includes('/login')) await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });
    // Multiple memberships must land on the company selector before brand create.
    await expect(page.getByRole('heading', { name: /choose a company|select company|اختر/i })).toBeVisible({
      timeout: 20_000,
    });
    const box = page.locator('main').getByRole('combobox');
    await expect(box).toBeVisible({ timeout: 20_000 });
    await box.click();
    await box.fill(companyA);
    const option = page.locator('main').getByRole('option', { name: new RegExp(companyA, 'i') });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/tenants/active') &&
          res.request().method() === 'POST' &&
          res.ok(),
        { timeout: 20_000 },
      ),
      option.click(),
    ]);
    await expect(page.getByTestId('product-home')).toBeVisible({
      timeout: 20_000,
    });
    await page.goto('/app/brands');
    await expect(page).toHaveURL(/\/app\/brands/);
    await page.getByRole('link', { name: /Create brand|إنشاء علامة/i }).first().click();
    const brandName = `Entry Brand ${newId().slice(-4)}`;
    await page.getByLabel(/brand name|اسم العلامة/i).fill(brandName);
    await page.getByRole('button', { name: /create|إنشاء/i }).click();
    await expect(page).toHaveURL(/\/app\/brands\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /overview|brand|نظرة/i }).first()).toBeVisible();
  });
});
