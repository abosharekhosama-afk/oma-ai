/** Month keys (YYYY-MM) for the monthly review picker: strategy start → current month. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function reviewMonthOptions(
  startIso: string | null | undefined,
  now: Date,
  locale: string,
  max = 24,
): Array<{ value: string; label: string }> {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const parsed = startIso ? new Date(startIso) : null;
  const start =
    parsed && !Number.isNaN(parsed.getTime())
      ? new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
      : current;
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const out: Array<{ value: string; label: string }> = [];
  for (
    let d = current;
    d >= start && out.length < max;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
  ) {
    out.push({ value: monthKey(d), label: fmt.format(d) });
  }
  return out.length ? out : [{ value: monthKey(current), label: fmt.format(current) }];
}
