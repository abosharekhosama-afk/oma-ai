import { parse as parseHtml } from 'node-html-parser';
import { isCatalogLikePath, isLowValueCrawlPath, isProductLikePathname } from './crawl-seeds';
import type { ExtractedProduct } from './extractors';
import { isProductDetailUrl } from './product-detection';

export type JsRenderMode = 'off' | 'auto' | 'always';

export function resolveJsRenderMode(raw?: string | null): JsRenderMode {
  // Auto-render only when static HTML looks like an SPA/catalog shell or lacks product media.
  // This keeps ordinary pages cheap while preventing client-rendered stores from yielding empty rows.
  const value = (raw ?? process.env.BRAND_SCANNER_JS_RENDER_MODE ?? 'auto').toLowerCase();
  if (value === 'force') return 'always';
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
  productMediaCount?: number;
  knownFieldCount?: number;
}): boolean {
  if (input.mode === 'off') return false;
  if (input.mode === 'always') return true;
  let path = '/';
  try {
    path = new URL(input.pageUrl).pathname;
  } catch {
    return looksLikeSpaShell(input.html);
  }
  const mediaCount = input.productMediaCount ?? 0;
  const knownFields = input.knownFieldCount ?? 0;
  if (looksLikeSpaShell(input.html)) return true;
  if (input.mode === 'auto' && isLowValueCrawlPath(path)) return false;
  const productLike = isProductLikePathname(path) || isCatalogLikePath(path);
  const detailUrl = isProductDetailUrl(input.pageUrl);
  if (productLike && input.productCount === 0) return true;
  if (detailUrl && input.productCount === 0) return true;
  if ((productLike || detailUrl) && input.productCount > 0 && mediaCount === 0) return true;
  if (detailUrl && input.productCount > 0 && knownFields < 2) return true;
  return false;
}

export function productMediaUrlCount(products: ExtractedProduct[]): number {
  return products.reduce((n, p) => n + (p.media?.length ?? 0), 0);
}

export function renderedExtractImprovesStatic(input: {
  staticProductCount: number;
  staticKnownFieldCount: number;
  staticProductMediaCount: number;
  renderedProductCount: number;
  renderedKnownFieldCount: number;
  renderedProductMediaCount: number;
}): boolean {
  return (
    input.renderedProductCount > input.staticProductCount ||
    input.renderedProductMediaCount > input.staticProductMediaCount ||
    input.renderedKnownFieldCount > input.staticKnownFieldCount
  );
}

export function shouldAdoptRenderedExtraction(
  mode: JsRenderMode,
  staticProductCount: number,
  staticKnownFieldCount: number,
  staticProductMediaCount: number,
  renderedProductCount: number,
  renderedKnownFieldCount: number,
  renderedProductMediaCount: number,
): boolean {
  if (mode === 'always') return true;
  return renderedExtractImprovesStatic({
    staticProductCount,
    staticKnownFieldCount,
    staticProductMediaCount,
    renderedProductCount,
    renderedKnownFieldCount,
    renderedProductMediaCount,
  });
}
