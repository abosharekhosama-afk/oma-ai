import type { Page } from '@playwright/test';

export async function chooseOmaSelect(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).click();
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .getByTitle(value, { exact: true })
    .click();
}
