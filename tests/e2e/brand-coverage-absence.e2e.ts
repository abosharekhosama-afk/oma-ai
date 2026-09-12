import { test, expect } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { createBrandFlow, registerBrandOwner } from './helpers/brand-api';
import { webOrigin } from './helpers/brand-ui';

test.describe('Coverage + unknown/missing (T169/T170)', () => {
  test('brand overview discloses scan coverage subset', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    const origin = webOrigin();
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);

    await page.goto(`/app/brands/${flow.brandId}`);
    await expect(page.locator('#brand-coverage')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/only the pages and fields this scan/i)).toBeVisible();
    await expect(page.getByTestId('coverage-required-missing')).toBeVisible();
    await expect(page.getByTestId('coverage-unknown-fields')).toBeVisible();
    await expect(page.getByTestId('coverage-failed-pages')).toBeVisible();
  });

  test('profile distinguishes required-not-found vs optional-unknown', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    expect(flow.profileVersionId).toBeTruthy();

    const prisma = getPrisma();
    const insights = await prisma.insightClaim.findMany({
      where: { profileVersionId: flow.profileVersionId! },
      take: 2,
      orderBy: { fieldKey: 'asc' },
    });
    expect(insights.length).toBeGreaterThanOrEqual(2);
    await prisma.insightClaim.update({
      where: { id: insights[0]!.id },
      data: {
        textValue: null,
        discoveryTier: 'REQUIRED_FOR_APPROVAL',
      },
    });
    await prisma.insightClaim.update({
      where: { id: insights[1]!.id },
      data: {
        textValue: null,
        discoveryTier: 'DISCOVER_WHEN_AVAILABLE',
      },
    });

    const origin = webOrigin();
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);

    await page.goto(`/app/brands/${flow.brandId}/profiles/${flow.profileVersionId}`);
    await expect(page.locator('[data-absence="required-not-found"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-absence="optional-unknown"]')).toBeVisible();
    await expect(page.getByText(/Required — not found in sources/i)).toBeVisible();
    await expect(page.getByText(/Optional — not observed/i)).toBeVisible();
  });
});
