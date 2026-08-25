import { test, expect } from '@playwright/test';

test('health live via rewrite', async ({ request }) => {
  const res = await request.get('/api/v1/health/live');
  expect(res.ok()).toBeTruthy();
});
