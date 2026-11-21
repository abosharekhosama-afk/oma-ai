/** Caps Playwright renders per scan so auto mode stays fast on large sites. */
export function maxJsRenderPagesFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.BRAND_SCANNER_JS_RENDER_MAX_PAGES?.trim();
  if (raw === '0' || raw === 'unlimited') return Number.POSITIVE_INFINITY;
  const n = Number(raw ?? 20);
  if (!Number.isFinite(n) || n < 0) return 20;
  return Math.min(Math.floor(n), 500);
}
