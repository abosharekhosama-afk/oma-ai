/** Storage quota maths shared by the subscription page and the media library. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Human bytes: `0 B`, `812 KB`, `3.4 MB`, `1.2 GB` (never "0.00 GB" for a few megabytes). */
export function formatStorageBytes(bytes: number, _locale = 'en') {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  let v = n;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : v < 10 ? 1 : 0;
  // Latin digits in both languages, matching the rest of the usage page.
  const num = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(v);
  return `${num} ${UNITS[i]}`;
}

export type StorageUsageView = {
  used: number;
  limit: number | null;
  unlimited: boolean;
  /** Exact share of the quota (0–100, one decimal), null when unlimited. */
  pct: number | null;
  /** Bar width: at least 1% once anything is stored, so real usage is never an empty bar. */
  barPct: number;
  remaining: number | null;
  tone: 'ok' | 'warn' | 'over';
};

export function storageUsageView(
  usedRaw: number | null | undefined,
  limitRaw: number | null | undefined,
): StorageUsageView {
  const used = Math.max(0, Number(usedRaw) || 0);
  const limit =
    limitRaw == null || !Number.isFinite(Number(limitRaw)) ? null : Math.max(0, Number(limitRaw));
  if (limit == null) {
    return {
      used,
      limit: null,
      unlimited: true,
      pct: null,
      barPct: used > 0 ? 4 : 0,
      remaining: null,
      tone: 'ok',
    };
  }
  if (limit === 0) {
    return {
      used,
      limit,
      unlimited: false,
      pct: used > 0 ? 100 : 0,
      barPct: used > 0 ? 100 : 0,
      remaining: 0,
      tone: used > 0 ? 'over' : 'ok',
    };
  }
  const exact = (used / limit) * 100;
  const pct = Math.min(100, Math.round(exact * 10) / 10);
  const barPct = used > 0 ? Math.min(100, Math.max(1, exact)) : 0;
  const tone = used >= limit ? 'over' : exact >= 80 ? 'warn' : 'ok';
  return { used, limit, unlimited: false, pct, barPct, remaining: Math.max(0, limit - used), tone };
}

/** `3.4 MB of 10 GB (0.1%)` / `3.4 MB من 10 GB (0.1%)`. */
export function storageUsageLabel(view: StorageUsageView, locale: string) {
  const ar = locale.startsWith('ar');
  const used = formatStorageBytes(view.used, locale);
  if (view.unlimited || view.limit == null)
    return ar ? `${used} · غير محدود` : `${used} · Unlimited`;
  const limit = formatStorageBytes(view.limit, locale);
  const pct = view.pct == null ? '' : ` (${view.pct < 0.1 && view.used > 0 ? '<0.1' : view.pct}%)`;
  return ar ? `${used} من ${limit}${pct}` : `${used} of ${limit}${pct}`;
}
