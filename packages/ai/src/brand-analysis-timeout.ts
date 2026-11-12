/** Longer default for post-scan synthesis (reasoning models + large evidence). */
export function brandAnalysisTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const dedicated = env.AI_BRAND_ANALYSIS_TIMEOUT_MS?.trim();
  if (dedicated) return Number(dedicated);
  const generic = env.AI_REQUEST_TIMEOUT_MS?.trim();
  if (generic) return Number(generic);
  return 120_000;
}
