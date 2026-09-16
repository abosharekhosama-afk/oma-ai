export type DiscoveryFilterable = {
  id: string;
  title: string | null;
  url: string;
  canonical_url?: string;
  classification: string;
  fetch_status: string;
};

export function filterDiscoveryPages<T extends DiscoveryFilterable>(
  pages: T[],
  opts: {
    query?: string;
    classification?: string;
    fetchStatus?: string;
    evidenceOnly?: boolean;
    evidenceByPage?: Record<string, string>;
  },
): T[] {
  const q = opts.query?.trim().toLowerCase() ?? '';
  return pages.filter((page) => {
    if (opts.classification && page.classification !== opts.classification) return false;
    if (opts.fetchStatus && page.fetch_status !== opts.fetchStatus) return false;
    if (opts.evidenceOnly && !opts.evidenceByPage?.[page.id]) return false;
    if (!q) return true;
    const haystack = `${page.title ?? ''} ${page.url} ${page.canonical_url ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}
