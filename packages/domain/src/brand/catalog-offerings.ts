import type { CatalogSummaryItem } from './catalog-summary';

export type CatalogOfferingKind = 'product' | 'service';

export type CatalogOffering = CatalogSummaryItem & {
  kind: CatalogOfferingKind;
  slug: string;
};

export const DEFAULT_MAX_CATALOG_PRODUCT_REQUESTS = 8;
export const DEFAULT_MAX_CATALOG_SERVICE_REQUESTS = 4;
export const DEFAULT_MAX_CATALOG_PAID_PRODUCT_REQUESTS = 3;

export function slugForCatalogName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'item';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function itemsFromCatalogField(value: unknown): CatalogSummaryItem[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((row) => {
        if (typeof row === 'string') return { name: row.trim() };
        const rec = asRecord(row);
        const name = String(rec.name ?? rec.label ?? rec.title ?? '').trim();
        if (!name) return null;
        return {
          name,
          description: typeof rec.description === 'string' ? rec.description : undefined,
          category: typeof rec.category === 'string' ? rec.category : undefined,
          price: typeof rec.price === 'string' ? rec.price : undefined,
        };
      })
      .filter(Boolean) as CatalogSummaryItem[];
  }
  const rec = asRecord(value);
  if (Array.isArray(rec.items)) return itemsFromCatalogField(rec.items);
  if (typeof rec.summary === 'string' && rec.summary.trim()) {
    return rec.summary
      .split(/[;|]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((name) => ({ name: name.replace(/\s*\([^)]*\).*$/, '').trim() }))
      .filter((item) => item.name);
  }
  return [];
}

export function catalogOfferingsFromProfileSections(
  sections: Record<string, unknown>,
): CatalogOffering[] {
  const catalog = asRecord(sections.catalog);
  const products = itemsFromCatalogField(catalog.products).map((item) => ({
    ...item,
    kind: 'product' as const,
    slug: slugForCatalogName(item.name),
  }));
  const services = itemsFromCatalogField(catalog.services).map((item) => ({
    ...item,
    kind: 'service' as const,
    slug: slugForCatalogName(item.name),
  }));
  return [...products, ...services];
}

export function catalogOfferingsFromDiscoveryRows(
  rows: Array<{
    kind: 'PRODUCT' | 'SERVICE' | string;
    name: string;
    description?: string | null;
    category?: string | null;
    priceAmount?: string | null;
    priceCurrency?: string | null;
  }>,
): CatalogOffering[] {
  return rows
    .map((row) => {
      const name = row.name.trim();
      if (!name) return null;
      const kind: CatalogOfferingKind = row.kind === 'SERVICE' ? 'service' : 'product';
      const price =
        row.priceAmount && row.priceCurrency
          ? `${row.priceAmount} ${row.priceCurrency}`
          : (row.priceAmount ?? undefined);
      return {
        kind,
        slug: slugForCatalogName(name),
        name,
        description: row.description ?? undefined,
        category: row.category ?? undefined,
        price,
      };
    })
    .filter(Boolean) as CatalogOffering[];
}

export function estimateCatalogContentRequests(
  offerings: CatalogOffering[],
  options?: { organicEnabled?: boolean; paidEnabled?: boolean },
): number {
  const products = offerings.filter((o) => o.kind === 'product');
  const services = offerings.filter((o) => o.kind === 'service');
  let count = 0;
  if (options?.organicEnabled !== false) {
    count += Math.min(products.length, DEFAULT_MAX_CATALOG_PRODUCT_REQUESTS);
    count += Math.min(services.length, DEFAULT_MAX_CATALOG_SERVICE_REQUESTS);
  }
  if (options?.paidEnabled) {
    count += Math.min(products.length, DEFAULT_MAX_CATALOG_PAID_PRODUCT_REQUESTS);
  }
  return count;
}
