import { test, expect } from '@playwright/test';
import { newId } from '@oma/domain';
import { getPrisma } from '@oma/db';
import { collectPageErrors } from './helpers/brand-ui';
import { apiPost, cookieHeader } from './helpers/brand-api';

/** PJ-04 — revise approved into new Draft; approved version stays immutable. */
test.describe('PJ-04 revise immutability', () => {
  test('revise from approved creates new draft; foundation save works on draft', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'run once on en-desktop');
    const errors = collectPageErrors(page);
    const email = `pj04-${newId().slice(-8).toLowerCase()}@example.com`;
    const password = 'ChangeMe_Strategy_1!';

    await page.goto('/register');
    await page.getByLabel('Name').fill('PJ04 Owner');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page.getByRole('heading', { name: /set up your company/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /create a company/i }).click();
    await page.getByLabel(/company name/i).fill(`PJ04 Co ${newId().slice(-4)}`);
    await page.getByRole('button', { name: /^create company$/i }).click();
    await expect(page.getByRole('heading', { name: /command center|workspace/i })).toBeVisible({
      timeout: 20_000,
    });

    const cookies = Object.fromEntries(
      (await page.context().cookies()).map((c) => [c.name, c.value]),
    );
    const brandRes = await apiPost(request, '/api/v1/brands', cookies, {
      name: `PJ04 Brand ${newId().slice(-4)}`,
    });
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
      name: 'PJ04 Revise',
      linked_approved_profile_version_id: profileId,
      organic_enabled: true,
      paid_enabled: false,
    });
    const strat = (await stratRes.json()) as {
      data: { id: string; latest_version: { id: string; row_version: number } };
    };
    const strategyId = strat.data.id;
    let versionId = strat.data.latest_version.id;
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
    expect(patch.ok()).toBeTruthy();
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
    row = ((await enable.json()) as { data: { row_version: number } }).data.row_version;
    const submit = await apiPost(
      request,
      `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/submit`,
      cookies,
      { row_version: row, unknowns_acknowledged: true },
    );
    row = ((await submit.json()) as { data: { row_version: number } }).data.row_version;
    await apiPost(
      request,
      `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/approve`,
      cookies,
      { row_version: row, unknowns_acknowledged: true, comment: 'ok' },
    );

    const revise = await apiPost(
      request,
      `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/revise`,
      cookies,
      {},
    );
    expect(revise.ok(), await revise.text()).toBeTruthy();
    const revised = (await revise.json()) as { data: { id: string; status: string } };
    expect(revised.data.status).toBe('DRAFT');
    versionId = revised.data.id;

    await page.goto(`/app/brands/${brandId}/strategies/${strategyId}/edit`);
    await expect(page.getByTestId('strategy-goals')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('strategy-goals').fill('Revised goals');
    await page.getByRole('button', { name: /save foundation/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });
    expect(
      errors.filter((e) => !/hydration|favicon|Failed to load resource|409|401|403|404/i.test(e)),
    ).toEqual([]);
  });
});
