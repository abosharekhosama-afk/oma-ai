import { expect, type Page } from '@playwright/test';

export type ContentViewMode = 'calendar' | 'feed' | 'grid' | 'list';

/** Planable LIVE_VERIFIED grammar: view options live in a dropdown, not always-visible tabs. */
export async function switchContentView(page: Page, mode: ContentViewMode) {
  const item = page.getByTestId(`demo-content-view-${mode}`);
  if (!(await item.isVisible().catch(() => false))) {
    await page.getByTestId('demo-content-view-trigger').click();
    await expect(item).toBeVisible({ timeout: 5_000 });
  }
  await item.click();
}
