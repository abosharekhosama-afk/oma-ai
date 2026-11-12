export type CatalogSummaryItem = {
  name: string;
  description?: string;
  category?: string;
  price?: string;
};

export type CatalogFieldValue = {
  summary: string;
  items: CatalogSummaryItem[];
};

function formatPrice(amount?: string | null, currency?: string | null): string | undefined {
  if (!amount) return undefined;
  const cur = currency?.trim();
  return cur ? `${amount} ${cur}` : amount;
}

function lineForItem(item: {
  name: string;
  description?: string | null;
  category?: string | null;
  priceAmount?: string | null;
  priceCurrency?: string | null;
}): string {
  const parts = [item.name.trim()];
  if (item.category?.trim()) parts.push(`(${item.category.trim()})`);
  const price = formatPrice(item.priceAmount, item.priceCurrency);
  if (price) parts.push(price);
  const desc = item.description?.trim();
  if (desc) parts.push(`— ${desc.slice(0, 160)}`);
  return parts.join(' ');
}

export function buildCatalogFieldValue(
  rows: Array<{
    kind: 'PRODUCT' | 'SERVICE';
    name: string;
    description?: string | null;
    category?: string | null;
    priceAmount?: string | null;
    priceCurrency?: string | null;
  }>,
  options?: { maxItems?: number },
): {
  products?: CatalogFieldValue;
  services?: CatalogFieldValue;
} {
  const maxItems = options?.maxItems ?? 48;
  const products = rows.filter((row) => row.kind === 'PRODUCT').slice(0, maxItems);
  const services = rows.filter((row) => row.kind === 'SERVICE').slice(0, maxItems);
  const out: { products?: CatalogFieldValue; services?: CatalogFieldValue } = {};
  if (products.length > 0) {
    out.products = {
      summary: products.map(lineForItem).join('; '),
      items: products.map((item) => ({
        name: item.name,
        description: item.description ?? undefined,
        category: item.category ?? undefined,
        price: formatPrice(item.priceAmount, item.priceCurrency),
      })),
    };
  }
  if (services.length > 0) {
    out.services = {
      summary: services.map(lineForItem).join('; '),
      items: services.map((item) => ({
        name: item.name,
        description: item.description ?? undefined,
        category: item.category ?? undefined,
        price: formatPrice(item.priceAmount, item.priceCurrency),
      })),
    };
  }
  return out;
}
