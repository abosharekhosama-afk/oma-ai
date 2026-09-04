import { test, expect } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { registerBrandOwner, trackE2eTenant } from './helpers/brand-api';
import { webOrigin } from './helpers/brand-ui';

/**
 * T161 / G-003: searchable company switcher with many memberships.
 * Activation uses the combobox UI (no page.evaluate).
 */
test.describe('Searchable company switcher', () => {
  test('user with many memberships finds a named company by typing', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const prisma = getPrisma();
    const targetName = `Needle Co ${newId().slice(-4)}`;
    const target = await prisma.tenant.create({
      data: {
        id: newId(),
        name: targetName,
        slug: `needle-${newId().slice(-8).toLowerCase()}`,
        status: 'ACTIVE',
      },
    });
    trackE2eTenant(target.id);
    await prisma.membership.create({
      data: {
        id: newId(),
        tenantId: target.id,
        userId: owner.userId,
        status: 'ACTIVE',
      },
    });
    for (let i = 0; i < 12; i++) {
      const t = await prisma.tenant.create({
        data: {
          id: newId(),
          name: `Noise Co ${i} ${newId().slice(-3)}`,
          slug: `noise-${i}-${newId().slice(-6).toLowerCase()}`,
          status: 'ACTIVE',
        },
      });
      trackE2eTenant(t.id);
      await prisma.membership.create({
        data: {
          id: newId(),
          tenantId: t.id,
          userId: owner.userId,
          status: 'ACTIVE',
        },
      });
    }

    const origin = webOrigin();
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);
    await page.goto('/app');
    const combobox = page
      .getByRole('combobox', { name: /company|tenant/i })
      .or(page.locator('[role="combobox"]').first());
    await expect(combobox).toBeVisible({ timeout: 20_000 });
    await combobox.click();
    await combobox.fill(targetName.slice(0, 10));
    const option = page.getByRole('option', { name: new RegExp(targetName, 'i') });
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });
    await page.reload();
    const after = page
      .getByRole('combobox', { name: /company/i })
      .or(page.locator('[role="combobox"]').first());
    await expect(after).toBeVisible({ timeout: 20_000 });
    await expect(after).toHaveAttribute('placeholder', new RegExp(targetName.slice(0, 8), 'i'));
  });
});
