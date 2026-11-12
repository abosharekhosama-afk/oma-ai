import { parse as parseHtml } from 'node-html-parser';
import { isCatalogLikePath } from './crawl-seeds';

export type JsRenderMode = 'off' | 'auto' | 'always';

export function resolveJsRenderMode(raw?: string | null): JsRenderMode {
  const value = (raw ?? process.env.BRAND_SCANNER_JS_RENDER_MODE ?? 'off').toLowerCase();
  if (value === 'auto' || value === 'always') return value;
  return 'off';
}

/** Detect client-rendered shells where static HTML carries little catalog content. */
export function looksLikeSpaShell(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed.length === 0) return false;
  const root = parseHtml(trimmed, { lowerCaseTagName: true });
  const mount =
    root.querySelector('#root') ??
    root.querySelector('#app') ??
    root.querySelector('[data-reactroot]');
  if (!mount) return false;
  const mountText = mount.text.replace(/\s+/g, ' ').trim();
  if (mountText.length > 200) return false;
  const hasModuleScript = Boolean(root.querySelector('script[type="module"]'));
  const hasReactHelmet = /react|vite|__NEXT_DATA__|ng-version/i.test(trimmed);
  return hasModuleScript || hasReactHelmet;
}

export function shouldUseJsRender(input: {
  mode: JsRenderMode;
  html: string;
  pageUrl: string;
  productCount: number;
}): boolean {
  if (input.mode === 'off') return false;
  if (input.mode === 'always') return true;
  let path = '/';
  try {
    path = new URL(input.pageUrl).pathname;
  } catch {
    return looksLikeSpaShell(input.html);
  }
  if (looksLikeSpaShell(input.html)) return true;
  if (isCatalogLikePath(path) && input.productCount === 0) return true;
  return false;
}

export function renderedExtractImprovesStatic(input: {
  staticProductCount: number;
  staticKnownFieldCount: number;
  renderedProductCount: number;
  renderedKnownFieldCount: number;
}): boolean {
  return (
    input.renderedProductCount > input.staticProductCount ||
    input.renderedKnownFieldCount > input.staticKnownFieldCount
  );
}

export function shouldAdoptRenderedExtraction(
  mode: JsRenderMode,
  staticProductCount: number,
  staticKnownFieldCount: number,
  renderedProductCount: number,
  renderedKnownFieldCount: number,
): boolean {
  if (mode === 'always') return true;
  return renderedExtractImprovesStatic({
    staticProductCount,
    staticKnownFieldCount,
    renderedProductCount,
    renderedKnownFieldCount,
  });
}
