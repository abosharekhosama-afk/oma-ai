import { test, expect } from '@playwright/test';
import { installOwnerSession } from './helpers/brand-ui';

const OPS_ROUTES: { path: string; testId: string }[] = [
  { path: '/app/campaigns', testId: 'demo-campaigns' },
  { path: '/app/requests', testId: 'demo-requests' },
  { path: '/app/tasks', testId: 'demo-tasks' },
  { path: '/app/deliverables', testId: 'demo-deliverables' },
  { path: '/app/reviews', testId: 'reviews-production' },
  { path: '/app/schedule', testId: 'demo-schedule' },
  { path: '/app/content', testId: 'demo-content' },
];

test.describe('Production ops surfaces', () => {
  test('core workspaces load without demo disclosure banner', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'en-desktop', 'desktop smoke');
    await installOwnerSession(page, request);
    for (const route of OPS_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByTestId(route.testId)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('demo-disclosure')).toHaveCount(0);
    }
  });
});
