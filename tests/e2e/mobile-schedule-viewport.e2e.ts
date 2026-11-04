import { expect, test } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';

test('mobile schedule fills the available screen and keeps week scrolling local', async ({
  page,
  request,
}) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 767, 'mobile-only viewport regression');

  await installOwnerSession(page, request);
  await page.goto('/app/schedule');

  const schedule = page.getByTestId('demo-schedule');
  await expect(schedule).toBeVisible();
  await expect(page.getByTestId('demo-schedule-calendar')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        x: bounds.x,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const calendarScroll = document.querySelector<HTMLElement>(
      '[data-testid="demo-schedule-calendar-scroll"]',
    );
    return {
      viewport: rect('.oma-shell'),
      schedule: rect('[data-testid="demo-schedule"]'),
      zoom: getComputedStyle(document.documentElement).zoom,
      density: getComputedStyle(document.documentElement)
        .getPropertyValue('--oma-mobile-density')
        .trim(),
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      calendarOverflowX: calendarScroll ? getComputedStyle(calendarScroll).overflowX : null,
      calendarClientWidth: calendarScroll?.clientWidth ?? 0,
      calendarScrollWidth: calendarScroll?.scrollWidth ?? 0,
    };
  });

  expect(geometry.viewport).not.toBeNull();
  expect(geometry.schedule).not.toBeNull();
  expect(geometry.schedule!.x).toBeCloseTo(geometry.viewport!.x, 0);
  expect(geometry.schedule!.right).toBeCloseTo(geometry.viewport!.right, 0);
  expect(geometry.schedule!.bottom).toBeCloseTo(geometry.viewport!.bottom, 0);
  expect(geometry.zoom).toBe('0.7');
  expect(geometry.density).toBe('0.7');
  expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.documentClientWidth);
  expect(geometry.calendarOverflowX).toBe('auto');
  expect(geometry.calendarScrollWidth).toBeGreaterThan(geometry.calendarClientWidth);
});
