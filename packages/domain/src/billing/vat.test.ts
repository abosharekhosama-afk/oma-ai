import { describe, expect, it } from 'vitest';
import { computeVat, formatVatPercent, normalizeVatRateBps, DEFAULT_VAT_RATE_BPS } from './vat';

describe('VAT calculation', () => {
  it('defaults to 17% and keeps the rate editable in basis points', () => {
    expect(DEFAULT_VAT_RATE_BPS).toBe(1700);
    expect(formatVatPercent(1700)).toBe('17%');
    expect(formatVatPercent(1800)).toBe('18%');
    expect(normalizeVatRateBps(1800)).toBe(1800);
    expect(normalizeVatRateBps(-1)).toBe(1700);
  });

  it('computes exclusive VAT server-side from cents', () => {
    expect(computeVat(3900, 1700)).toEqual({
      ex_vat_cents: 3900,
      vat_rate_bps: 1700,
      vat_cents: 663,
      inc_vat_cents: 4563,
    });
    expect(computeVat(7900, 1800)).toEqual({
      ex_vat_cents: 7900,
      vat_rate_bps: 1800,
      vat_cents: 1422,
      inc_vat_cents: 9322,
    });
    expect(computeVat(24900, 1700).inc_vat_cents).toBe(24900 + Math.round((24900 * 1700) / 10000));
  });
});
