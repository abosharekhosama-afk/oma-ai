import { test } from '@playwright/test';

test.describe('scan → strategy closure (005 T041)', () => {
  test.skip(!process.env.CLOSURE_PROOF_URL, 'Set CLOSURE_PROOF_URL to run live crawl closure e2e');

  test('placeholder — manual closure journey documented in specs/005 quickstart', () => {
    test.skip();
  });
});
