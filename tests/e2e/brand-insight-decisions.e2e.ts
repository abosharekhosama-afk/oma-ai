import { test, expect } from '@playwright/test';
import { getPrisma } from '@oma/db';
import { createBrandFlow, registerBrandOwner } from './helpers/brand-api';
import { webOrigin } from './helpers/brand-ui';

test.describe('Insight accept/reject UI (T164 / G-011)', () => {
  test('accepts AI_INFERRED insight through the profile UI', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    expect(flow.profileVersionId).toBeTruthy();

    const prisma = getPrisma();
    const insight = await prisma.insightClaim.findFirstOrThrow({
      where: { profileVersionId: flow.profileVersionId! },
      orderBy: { fieldKey: 'asc' },
    });
    await prisma.insightClaim.update({
      where: { id: insight.id },
      data: {
        infoState: 'AI_INFERRED',
        reviewStatus: 'PENDING',
        textValue: insight.textValue ?? 'Inferred value for E2E',
      },
    });

    const origin = webOrigin();
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);

    await page.goto(`/app/brands/${flow.brandId}/profiles/${flow.profileVersionId}`);
    await expect(page.getByRole('heading', { name: 'Brand intelligence' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Accept' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Accept' }).first().click();
    await expect(page.getByText('No AI insights are waiting for a decision.')).toBeVisible({
      timeout: 15_000,
    });

    const after = await prisma.insightClaim.findUniqueOrThrow({ where: { id: insight.id } });
    expect(after.infoState).toBe('USER_CONFIRMED');
    expect(after.reviewStatus).toBe('ACCEPTED');
  });

  test('rejects AI_INFERRED insight through the profile UI', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const owner = await registerBrandOwner(request);
    const flow = await createBrandFlow(request, owner.cookies);
    expect(flow.profileVersionId).toBeTruthy();

    const prisma = getPrisma();
    const insight = await prisma.insightClaim.findFirstOrThrow({
      where: { profileVersionId: flow.profileVersionId! },
      orderBy: { fieldKey: 'asc' },
    });
    await prisma.insightClaim.update({
      where: { id: insight.id },
      data: {
        infoState: 'AI_INFERRED',
        reviewStatus: 'PENDING',
        textValue: 'Reject me',
      },
    });

    const origin = webOrigin();
    await page.context().addCookies([
      { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
      { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
    ]);

    await page.goto(`/app/brands/${flow.brandId}/profiles/${flow.profileVersionId}`);
    await expect(page.getByRole('button', { name: 'Reject' }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Reject', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0, {
      timeout: 15_000,
    });

    const after = await prisma.insightClaim.findUniqueOrThrow({ where: { id: insight.id } });
    expect(after.reviewStatus).toBe('REJECTED');
  });
});
