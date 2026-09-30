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
  const dialog = page.getByRole('dialog').filter({ has: sheet });
  const confirm = dialog
    .locator('.oma-dialog-footer .ant-btn-primary, .oma-dialog-footer button')
    .first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect(sheet).toHaveCount(0);
}

export async function applyCampaignFilters(page: Page) {
  await closeFilterSheet(page, 'demo-campaign-filter-sheet');
}

export async function applyContentFilters(page: Page) {
  await closeFilterSheet(page, 'demo-content-filter-sheet');
}
