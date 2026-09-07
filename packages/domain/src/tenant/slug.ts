const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'health',
  'login',
  'oma',
  'oma-demo',
  'platform',
  'register',
  'root',
  'settings',
  'static',
  'support',
  'system',
  'www',
]);

export function normalizeCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function assertCompanyName(name: string): string {
  const normalized = normalizeCompanyName(name);
  if (normalized.length < 2 || normalized.length > 120) {
    throw new Error('Company name must be 2–120 characters');
  }
  return normalized;
}

/** Derive a URL-safe slug candidate from a company name. */
export function slugifyCompanyName(name: string): string {
  const base = normalizeCompanyName(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base.length >= 2 ? base : `company-${Date.now().toString(36)}`;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

export function assertSlugCandidate(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ||
    normalized.length < 2 ||
    normalized.length > 64
  ) {
    throw new Error('Invalid company slug');
  }
  if (isReservedSlug(normalized)) {
    throw new Error('Reserved company slug');
  }
  return normalized;
}

/** Produce a unique slug by appending a short suffix when the base is taken or reserved. */
export async function uniquifySlug(
  base: string,
  isTaken: (slug: string) => boolean | Promise<boolean>,
): Promise<string> {
  const raw = (isReservedSlug(base) ? `${base}-co` : base).replace(/[^a-z0-9-]/g, '').slice(0, 48);
  const start = raw.length >= 2 ? raw : `co-${Date.now().toString(36)}`;
  let candidate = assertSlugCandidate(start);
  if (!(await isTaken(candidate))) return candidate;
  for (let i = 0; i < 20; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = assertSlugCandidate(`${start.slice(0, 48)}-${suffix}`);
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error('Unable to allocate unique company slug');
}
