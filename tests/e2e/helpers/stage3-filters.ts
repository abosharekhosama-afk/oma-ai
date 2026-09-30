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

async function closeFilterSheet(page: Page, sheetTestId: string) {
  const sheet = page.getByTestId(sheetTestId);
  if (!(await sheet.isVisible().catch(() => false))) return;
  // Dismiss Ant dropdown/picker overlays first.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const confirm = page.locator('.ant-modal-body .oma-dialog-footer .ant-btn-primary').last();
  await expect(confirm).toBeVisible({ timeout: 5_000 });
  await confirm.click();
  await expect(sheet).toHaveCount(0, { timeout: 10_000 });
}

export async function applyCampaignFilters(page: Page) {
  await closeFilterSheet(page, 'demo-campaign-filter-sheet');
}

export async function applyContentFilters(page: Page) {
  await closeFilterSheet(page, 'demo-content-filter-sheet');
}
