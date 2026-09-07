import { test, expect } from '@playwright/test';

for (const width of [1440, 1024, 390]) {
  test(`app shell no overflow at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app');
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    );
    expect(scroll).toBe(true);
  });
}
