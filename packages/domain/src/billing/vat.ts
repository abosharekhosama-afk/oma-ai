/** Basis points: 1700 = 17.00%. Stored in settings so Israel can switch to 18% (1800). */
export const DEFAULT_VAT_RATE_BPS = 1700;
export const DEFAULT_GRACE_PERIOD_DAYS = 7;
export const DEFAULT_TRIAL_DAYS = 14;
export const DEFAULT_X_API_ADDON_USD_CENTS = 2900;
export const X_API_ADDON_CODE = 'x_api' as const;
/** Yearly list price is 10 months (two months complimentary). */
export const YEARLY_MONTHS_CHARGED = 10;

export type VatBreakdown = {
  ex_vat_cents: number;
  vat_rate_bps: number;
  vat_cents: number;
  inc_vat_cents: number;
};

export function normalizeVatRateBps(value: unknown, fallback = DEFAULT_VAT_RATE_BPS): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 5000) return fallback;
  return Math.round(n);
}

/** Server-side VAT. Never trust a client-supplied total. */
export function computeVat(exVatCents: number, vatRateBps = DEFAULT_VAT_RATE_BPS): VatBreakdown {
  if (!Number.isFinite(exVatCents) || exVatCents < 0) {
    throw new RangeError('exVatCents must be a non-negative number');
  }
  const rate = normalizeVatRateBps(vatRateBps);
  const base = Math.round(exVatCents);
  const vat = Math.round((base * rate) / 10_000);
  return {
    ex_vat_cents: base,
    vat_rate_bps: rate,
    vat_cents: vat,
    inc_vat_cents: base + vat,
  };
}

export function formatVatPercent(vatRateBps: number): string {
  const rate = normalizeVatRateBps(vatRateBps);
  const whole = Math.floor(rate / 100);
  const frac = rate % 100;
  return frac === 0 ? `${whole}%` : `${(rate / 100).toFixed(2)}%`;
}

export function addDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}
