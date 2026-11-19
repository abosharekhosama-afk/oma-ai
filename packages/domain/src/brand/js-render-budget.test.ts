import { describe, expect, it } from 'vitest';
import { maxJsRenderPagesFromEnv } from './js-render-budget';

describe('maxJsRenderPagesFromEnv', () => {
  it('defaults to 20 renders per scan', () => {
    expect(maxJsRenderPagesFromEnv({})).toBe(20);
  });

  it('allows unlimited when configured', () => {
    expect(maxJsRenderPagesFromEnv({ BRAND_SCANNER_JS_RENDER_MAX_PAGES: 'unlimited' })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});