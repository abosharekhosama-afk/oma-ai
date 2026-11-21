/** Upper bound for pages per scan (API clamps user/env requests). */
export function scanMaxPagesCap(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.BRAND_SCAN_MAX_PAGES_CAP ?? '250');
  if (!Number.isFinite(n) || n < 20) return 250;
  return Math.min(Math.floor(n), 2000);
}

export function clampScanMaxPages(
  requested: number | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const base = requested ?? Number(env.BRAND_MAX_PAGES ?? 50);
  const cap = scanMaxPagesCap(env);
  if (!Number.isFinite(base) || base < 1) return Math.min(50, cap);
  return Math.min(Math.floor(base), cap);
}
