import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { apiPost, FIXTURE_WEBSITE_URL, registerBrandOwner } from './brand-api';

export function webOrigin(): string {
  return process.env.WEB_BASE_URL ?? `http://127.0.0.1:${process.env.WEB_PORT ?? '3000'}`;
}

export async function installOwnerSession(page: Page, request: APIRequestContext) {
  const owner = await registerBrandOwner(request);
  const origin = webOrigin();
  await page.context().addCookies([
    { name: 'oma_session', value: owner.cookies.oma_session, url: origin },
    { name: 'oma_csrf', value: owner.cookies.oma_csrf, url: origin },
  ]);
  await page.goto('/app');
  await page.evaluate(
    async ({ tenantId, csrf }) => {
      const res = await fetch('/api/v1/tenants/active', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (!res.ok) throw new Error(`tenant activate failed: ${res.status} ${await res.text()}`);
    },
    { tenantId: owner.tenantId, csrf: owner.cookies.oma_csrf },
  );
  return owner;
}

export async function uiCreateBrandConnectAndStartScan(
  page: Page,
  request: APIRequestContext,
  owner: Awaited<ReturnType<typeof registerBrandOwner>>,
  brandName?: string,
) {
  const name = brandName ?? `E2E ${Date.now().toString().slice(-6)}`;
  const created = await apiPost(request, '/api/v1/brands', owner.cookies, { name });
  expect(created.ok(), await created.text()).toBeTruthy();
  const brandId = ((await created.json()) as { data: { id: string } }).data.id;

  await page.goto(`/app/brands/${brandId}/connect`);
  await expect(page.getByRole('heading', { name: 'Connect website' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel('Website URL').fill(FIXTURE_WEBSITE_URL);
  await page.getByLabel(/authorized to scan/i).check();
  await page.getByRole('button', { name: 'Connect website' }).click();
  await expect(page).toHaveURL(`/app/brands/${brandId}`);

  await page.goto(`/app/brands/${brandId}/scans/new`);
  await expect(page.getByLabel(/understand these crawl limits/i)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/understand these crawl limits/i).check();
  await page.getByRole('button', { name: 'Start scan' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/brands/${brandId}/scans/[^/]+$`));
  const scanId = page.url().split('/').pop()!;

  return { brandId, scanId, brandName: name };
}

export async function uiWaitForScanTerminal(page: Page) {
  await expect(page.locator('.oma-badge', { hasText: /PARTIAL|SUCCEEDED|FAILED|CANCELLED/ })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole('link', { name: 'View profile draft' })).toBeVisible({
    timeout: 5_000,
  });
}

export async function uiOpenProfileDraft(page: Page) {
  await page.getByRole('link', { name: 'View profile draft' }).click();
  await expect(page.getByRole('heading', { name: 'Brand intelligence' })).toBeVisible();
}

export async function uiSubmitForReviewIfNeeded(page: Page) {
  const submit = page.getByRole('button', { name: 'Submit for review' });
  if (await submit.isVisible()) {
    await submit.click();
    await expect(page.locator('.oma-badge', { hasText: 'NEEDS_REVIEW' })).toBeVisible();
  }
}

export async function uiApproveProfile(page: Page) {
  await page.getByLabel(/confirm this profile summary/i).check();
  const ack = page.getByLabel(/acknowledge incomplete scan coverage/i);
  if (await ack.isVisible()) {
    await ack.check();
  }
  await page.getByRole('button', { name: 'Approve profile' }).click();
  await expect(page.locator('.oma-badge', { hasText: 'APPROVED' }).first()).toBeVisible({
    timeout: 20_000,
  });
}

export async function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}
