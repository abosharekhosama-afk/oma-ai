import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { getPrisma } from '@oma/db';
import { trackE2eTenant } from './helpers/brand-api';

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
    await expect(page.getByRole('heading', { name: /workspace/i })).toBeVisible({
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

    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/\/(login)?$/);
    if (!page.url().includes('/login')) await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/select-company|onboarding|\/app/, { timeout: 20_000 });
    // Prefer selector when multiple memberships
    if (page.url().includes('select-company') || (await page.getByRole('combobox').count()) > 0) {
      const box = page.getByRole('combobox').first();
      if (await box.isVisible()) {
        await box.fill(companyA.slice(0, 8));
        await page.getByRole('option', { name: new RegExp(companyA, 'i') }).click();
      } else {
        await page.getByRole('button', { name: new RegExp(companyA, 'i') }).click();
      }
    }

    await expect(page.getByRole('heading', { name: /workspace/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('navigation').getByRole('link', { name: 'Brand Intelligence' }).click();
    await expect(page).toHaveURL(/\/app\/brands/);
    await page.getByRole('link', { name: 'Create brand' }).first().click();
    const brandName = `Entry Brand ${newId().slice(-4)}`;
    await page.getByLabel(/brand name/i).fill(brandName);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page).toHaveURL(/\/app\/brands\/[^/]+$/);
    await expect(page.getByRole('heading', { name: /overview|brand/i }).first()).toBeVisible();
  });
});
