export type BrandNavSection = 'overview' | 'evidence' | 'strategy' | 'settings';

export type BrandNavLink = {
  id: string;
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

export function brandNavSection(pathname: string, brandId: string): BrandNavSection {
  const base = `/app/brands/${brandId}`;
  if (pathname === base) return 'overview';
  if (pathname.includes('/settings')) return 'settings';
  if (
    pathname.includes('/connect') ||
    pathname.includes('/scans') ||
    pathname.includes('/discovery') ||
    pathname.includes('/evidence')
  ) {
    return 'evidence';
  }
  if (
    pathname.includes('/profiles') ||
    pathname.includes('/strategies') ||
    pathname.includes('/intelligence')
  ) {
    return 'strategy';
  }
  return 'overview';
}

export function buildBrandPrimaryNav(brandId: string, t: (key: string) => string): BrandNavLink[] {
  const base = `/app/brands/${brandId}`;
  return [
    {
      id: 'overview',
      href: base,
      label: t('brand.nav.overview'),
      match: (p) => p === base,
    },
    {
      id: 'evidence',
      href: `${base}/evidence`,
      label: t('brand.nav.evidence'),
      match: (p) =>
        p.includes('/connect') ||
        p.includes('/scans') ||
        p.includes('/discovery') ||
        p.includes('/evidence'),
    },
    {
      id: 'strategy',
      href: `${base}/intelligence`,
      label: t('brand.nav.strategyHub'),
      match: (p) =>
        p.includes('/profiles') || p.includes('/strategies') || p.includes('/intelligence'),
    },
    {
      id: 'settings',
      href: `${base}/settings`,
      label: t('brand.nav.settings'),
      match: (p) => p.includes('/settings'),
    },
  ];
}

export function buildBrandEvidenceSubnav(
  brandId: string,
  latestScanId: string | null | undefined,
  t: (key: string) => string,
): BrandNavLink[] {
  const base = `/app/brands/${brandId}`;
  const scanHref = latestScanId ? `${base}/scans/${latestScanId}` : `${base}/scans/new`;
  return [
    {
      id: 'website',
      href: `${base}/connect`,
      label: t('brand.nav.website'),
      match: (p) => p.includes('/connect'),
    },
    {
      id: 'scan',
      href: scanHref,
      label: t('brand.nav.scan'),
      match: (p) => p.includes('/scans'),
    },
    {
      id: 'discovery',
      href: `${base}/discovery`,
      label: t('brand.nav.discovery'),
      match: (p) => p.includes('/discovery') && !p.includes('/evidence'),
    },
    {
      id: 'evidence-hub',
      href: `${base}/evidence`,
      label: t('brand.nav.evidenceHub'),
      match: (p) => p.endsWith('/evidence'),
    },
  ];
}

export function buildBrandStrategySubnav(
  brandId: string,
  t: (key: string) => string,
): BrandNavLink[] {
  const base = `/app/brands/${brandId}`;
  return [
    {
      id: 'intelligence-hub',
      href: `${base}/intelligence`,
      label: t('brand.nav.intelligenceHub'),
      match: (p) => p.endsWith('/intelligence'),
    },
    {
      id: 'profiles',
      href: `${base}/profiles`,
      label: t('brand.nav.profiles'),
      match: (p) => p.includes('/profiles'),
    },
    {
      id: 'strategies',
      href: `${base}/strategies`,
      label: t('brand.nav.strategies'),
      match: (p) => p.includes('/strategies'),
    },
  ];
}

export function journeyStepHref(
  brandId: string,
  stepId: string,
  latestScanId: string | null | undefined,
): string {
  const base = `/app/brands/${brandId}`;
  switch (stepId) {
    case 'connect':
      return `${base}/connect`;
    case 'scan':
      return latestScanId ? `${base}/scans/${latestScanId}` : `${base}/scans/new`;
    case 'discover':
      return `${base}/discovery`;
    case 'intel':
      return `${base}/intelligence`;
    case 'strategy':
      return `${base}/strategies`;
    default:
      return base;
  }
}
