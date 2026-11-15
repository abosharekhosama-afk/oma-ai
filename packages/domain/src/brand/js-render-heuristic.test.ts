import { describe, expect, it } from 'vitest';
import {
  looksLikeSpaShell,
  resolveJsRenderMode,
  shouldAdoptRenderedExtraction,
  shouldUseJsRender,
} from './js-render-heuristic';

const SPA_SHELL = `<!DOCTYPE html><html><head><title>VELVET</title></head><body>
<div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>`;

describe('js-render-heuristic', () => {
  it('defaults to auto rendering when no explicit mode is configured', () => {
    expect(resolveJsRenderMode(undefined)).toBe('auto');
    expect(resolveJsRenderMode('off')).toBe('off');
  });

  it('detects empty root + module script', () => {
    expect(looksLikeSpaShell(SPA_SHELL)).toBe(true);
  });

  it('does not flag rich server HTML', () => {
    const html = `<html><body><main><h1>Product A</h1><p>Long description here</p></main></body></html>`;
    expect(looksLikeSpaShell(html)).toBe(false);
  });

  it('auto mode renders SPA and catalog paths without products', () => {
    expect(
      shouldUseJsRender({
        mode: 'auto',
        html: SPA_SHELL,
        pageUrl: 'https://shop.test/products',
        productCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldUseJsRender({
        mode: 'auto',
        html: '<html><body><ul><li>Item</li></ul></body></html>',
        pageUrl: 'https://shop.test/about',
        productCount: 2,
      }),
    ).toBe(false);
    expect(
      shouldUseJsRender({
        mode: 'auto',
        html: '<html><body><h1>Shoe</h1></body></html>',
        pageUrl: 'https://shop.test/product/shoe',
        productCount: 1,
        productMediaCount: 0,
      }),
    ).toBe(true);
  });

  it('always mode adopts render even without product delta', () => {
    expect(shouldAdoptRenderedExtraction('always', 0, 2, 0, 0, 2, 0)).toBe(true);
    expect(shouldAdoptRenderedExtraction('auto', 0, 2, 0, 0, 2, 0)).toBe(false);
    expect(shouldAdoptRenderedExtraction('auto', 1, 2, 0, 1, 2, 3)).toBe(true);
  });
});
