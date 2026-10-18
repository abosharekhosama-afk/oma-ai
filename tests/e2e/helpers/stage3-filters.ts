import { expect, type Page } from '@playwright/test';

/** Open progressive filter sheet so advanced filter controls are visible/interactable. */
export async function openCampaignFilters(page: Page) {
  const sheet = page.getByTestId('demo-campaign-filter-sheet');
  if (await sheet.isVisible().catch(() => false)) return;
  await page.getByTestId('demo-campaign-open-filters').click();
  await expect(sheet).toBeVisible({ timeout: 10_000 });
}

export async function openContentFilters(page: Page) {
  const sheet = page.getByTestId('demo-content-filter-sheet');
  if (await sheet.isVisible().catch(() => false)) return;
  await page.getByTestId('demo-content-open-filters').click();
  await expect(sheet).toBeVisible({ timeout: 10_000 });
}

async function applyFilterSheet(page: Page, sheetTestId: string, applyTestId: string) {
  const sheet = page.getByTestId(sheetTestId);
  if (!(await sheet.isVisible().catch(() => false))) return;
  // Apply in the overlay footer (a centered dialog or the content filter drawer).
  const apply = page.getByTestId(applyTestId);
  await expect(apply).toBeVisible({ timeout: 5_000 });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(sheet).toHaveCount(0, { timeout: 10_000 });
}

export async function applyCampaignFilters(page: Page) {
  await applyFilterSheet(page, 'demo-campaign-filter-sheet', 'demo-campaign-filter-apply');
}

export async function applyContentFilters(page: Page) {
  await applyFilterSheet(page, 'demo-content-filter-sheet', 'demo-content-filter-apply');
}
