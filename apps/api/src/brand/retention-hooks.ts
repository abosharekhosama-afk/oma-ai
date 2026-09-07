/**
 * Soft archive/retention boundary hooks.
 * Hard delete gated by DEC-012 — archive only until retention policy is approved.
 */
export function shouldRetainArchivedBrand(): boolean {
  return true;
}

export function brandRetentionDays(): number | null {
  return null;
}
