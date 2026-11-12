import type { CatalogFieldValue, CatalogSummaryItem } from './catalog-summary';

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function summaryFromItems(items: CatalogSummaryItem[]): string {
  return items
    .map((item) => {
      const parts = [item.name];
      if (item.category) parts.push(`(${item.category})`);
      if (item.price) parts.push(item.price);
      if (item.description) parts.push(`— ${item.description.slice(0, 160)}`);
      return parts.join(' ');
    })
    .join('; ');
}

export function parseCatalogFieldValue(
  textValue: string | null | undefined,
  valueJson?: unknown,
): CatalogFieldValue | null {
  if (valueJson && typeof valueJson === 'object' && valueJson !== null) {
    const v = valueJson as CatalogFieldValue;
    if (Array.isArray(v.items)) return v;
  }
  if (!textValue?.trim()) return null;
  try {
    const parsed = JSON.parse(textValue) as CatalogFieldValue;
    if (parsed && Array.isArray(parsed.items)) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function discoveryRowsToCatalogItems(
  rows: Array<{
    name: string;
    description?: string | null;
    category?: string | null;
    priceAmount?: string | null;
    priceCurrency?: string | null;
  }>,
): CatalogSummaryItem[] {
  return rows.map((row) => {
    const price = row.priceAmount?.trim()
      ? row.priceCurrency?.trim()
        ? `${row.priceAmount} ${row.priceCurrency}`
        : row.priceAmount
      : undefined;
    return {
      name: row.name.trim(),
      description: row.description?.trim() || undefined,
      category: row.category?.trim() || undefined,
      price,
    };
  });
}

export function mergeCatalogFieldValues(
  existing: CatalogFieldValue | null | undefined,
  additions: CatalogSummaryItem[],
): CatalogFieldValue {
  const seen = new Set<string>();
  const items: CatalogSummaryItem[] = [];
  for (const item of [...(existing?.items ?? []), ...additions]) {
    const key = normalizeName(item.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return { summary: summaryFromItems(items), items };
}
