import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { getPrisma } from '@oma/db';
import { collectPageErrors } from './helpers/brand-ui';
import { apiPost, cookieHeader } from './helpers/brand-api';

test.describe('PJ-02 package approve', () => {
  test('approve via UI does not set current badge until set current', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors = collectPageErrors(page);
    const email = `pj02-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Strategy_1!';

    await page.goto('/register');
    await page.getByLabel('Name').fill('PJ02 Owner');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /create a company/i }).click();
    await page.getByLabel(/company name/i).fill(`PJ02 Co ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /^create company$/i }).click();
    await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible({
      timeout: 20_000,
    });

    const cookies = Object.fromEntries(
      (await page.context().cookies()).map((c) => [c.name, c.value]),
    );
    const brandRes = await apiPost(request, '/api/v1/brands', cookies, {
      name: `PJ02 Brand ${newId().slice(-4)}`,
    });
    expect(brandRes.ok(), await brandRes.text()).toBeTruthy();
    const brandId = ((await brandRes.json()) as { data: { id: string } }).data.id;

    const prisma = getPrisma();
    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email } },
      select: { tenantId: true },
    });
    const profileId = newId();
    await prisma.profileVersion.create({
      data: {
        id: profileId,
        tenantId: membership.tenantId,
        brandId,
        status: 'APPROVED',
        sectionsJson: '{}',
        approvedAt: new Date(),
        incompletenessAcknowledged: true,
      },
    });

    const stratRes = await apiPost(request, `/api/v1/brands/${brandId}/strategies`, cookies, {
      name: 'PJ02 Package',
      linked_approved_profile_version_id: profileId,
      organic_enabled: true,
      paid_enabled: false,
    });
    expect(stratRes.ok(), await stratRes.text()).toBeTruthy();
    const strat = (await stratRes.json()) as {
      data: { id: string; latest_version: { id: string; row_version: number } };
    };
    const strategyId = strat.data.id;
    const versionId = strat.data.latest_version.id;
    let row = strat.data.latest_version.row_version;
    const api = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

    const patch = await request.patch(
      `${api}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`,
      {
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader(cookies),
          'x-csrf-token': cookies.oma_csrf,
        },
        data: {
          row_version: row,
          foundation: {
            goals: [{ value: 'Grow', infoClass: 'USER_AUTHORED' }],
            positioning: { value: 'Partner', infoClass: 'USER_AUTHORED' },
          },
        },
      },
    );
    expect(patch.ok(), await patch.text()).toBeTruthy();
    row = ((await patch.json()) as { data: { row_version: number } }).data.row_version;

    const enable = await apiPost(
      request,
      `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/tracks/enablement`,
      cookies,
      {
        row_version: row,
        organic_enabled: true,
        paid_enabled: false,
        paid_disabled_rationale: 'Deferred',
      },
    );
    expect(enable.ok(), await enable.text()).toBeTruthy();
    row = ((await enable.json()) as { data: { row_version: number } }).data.row_version;

    const submit = await apiPost(
      request,
      `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/submit`,
      cookies,
      { row_version: row, unknowns_acknowledged: true },
    );
    expect(submit.ok(), await submit.text()).toBeTruthy();

    await page.goto(`/app/brands/${brandId}/strategies/${strategyId}/review`);
    await page.getByTestId('strategy-unknowns').check();
    await page.getByTestId('strategy-approve').click();
    await expect(page.getByRole('status').or(page.getByText(/saved/i))).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(`/app/brands/${brandId}/strategies/${strategyId}`);
    await expect(page.getByTestId('strategy-name-heading')).toBeVisible();
    await expect(page.getByTestId('strategy-current-badge')).toHaveCount(0);
    await expect(page.getByTestId('strategy-set-current')).toBeVisible();
    expect(
      errors.filter((e) => !/hydration|favicon|Failed to load resource|409|401|403|404/i.test(e)),
    ).toEqual([]);
  });
});
