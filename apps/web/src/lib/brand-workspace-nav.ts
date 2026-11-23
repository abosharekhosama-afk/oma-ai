export type BrandNavSection = 'overview' | 'evidence' | 'strategy' | 'settings';

export type JourneyState = 'done' | 'current' | 'todo';

export type BrandNavLink = {
  id: string;
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  /** Journey progress for this destination (shown as a dot on the sub-nav tab). */
  state?: JourneyState;
};

/** Sub-nav tab id → brand journey step id (see buildBrandJourneySteps). */
const SUBNAV_JOURNEY_STEP: Record<string, string> = {
  website: 'connect',
  scan: 'scan',
  discovery: 'discover',
  profiles: 'intel',
  strategies: 'strategy',
};

/**
 * Folds journey progress into the sub-nav so the workspace shows one navigation row
 * instead of a separate journey strip that links to the same pages.
 */
export function withJourneyState(
  links: BrandNavLink[],
  journey: Array<{ id: string; state: JourneyState }> | undefined,
): BrandNavLink[] {
  if (!journey?.length) return links;
  const byStep = new Map(journey.map((step) => [step.id, step.state]));
  return links.map((link) => {
    const step = SUBNAV_JOURNEY_STEP[link.id];
    const state = step ? byStep.get(step) : undefined;
    return state ? { ...link, state } : link;
  });
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBrandRecordId(segment: string): boolean {
  return ULID_RE.test(segment) || UUID_RE.test(segment);
}

const BRAND_TRAIL_SEGMENT_KEYS: Record<string, string> = {
  connect: 'brand.nav.website',
  scans: 'brand.nav.scan',
  discovery: 'brand.nav.discovery',
  seo: 'brand.nav.seo',
  evidence: 'brand.nav.evidenceHub',
  intelligence: 'brand.nav.intelligenceHub',
  profiles: 'brand.nav.profiles',
  strategies: 'brand.nav.strategies',
  briefs: 'brand.nav.briefs',
  settings: 'brand.nav.settings',
  organic: 'strategy.nav.organic',
  paid: 'strategy.nav.paid',
  edit: 'strategy.nav.foundation',
  review: 'strategy.nav.review',
  versions: 'strategy.nav.versions',
  execution: 'strategy.tab.execution',
  compare: 'brand.profile.compare',
  products: 'brand.discovery.productsTitle',
  pages: 'brand.discovery.pagesTitle',
  new: 'common.new',
};

/** `/app/brands/:brandId/strategies/:strategyId[/section]` → ids, else null. */
export function strategyRouteParts(
  pathname: string,
  brandId: string,
): { strategyId: string; section: string | null } | null {
  const prefix = `/app/brands/${brandId}/strategies/`;
  if (!pathname.startsWith(prefix)) return null;
  const [strategyId, section] = pathname.slice(prefix.length).split('/');
  if (!strategyId || !isBrandRecordId(strategyId)) return null;
  return { strategyId, section: section || null };
}

/** Section label under a strategy (null on the strategy overview itself). */
export function strategySectionLabel(
  section: string | null,
  t: (key: string) => string,
): string | null {
  if (!section) return null;
  const key = section === 'evidence' ? 'strategy.nav.evidence' : BRAND_TRAIL_SEGMENT_KEYS[section];
  return key ? t(key) : null;
}

/** Human tail for shell breadcrumb on brand routes (no raw record ids). */
export function brandPathTailLabel(
  pathname: string,
  brandId: string,
  t: (key: string) => string,
): string | null {
  const prefix = `/app/brands/${brandId}/`;
  if (!pathname.startsWith(prefix)) return null;
  const segments = pathname.slice(prefix.length).split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const last = segments[segments.length - 1]!;
  if (isBrandRecordId(last) && segments.length >= 2) {
    const parent = segments[segments.length - 2]!;
    if (parent === 'profiles') return t('brand.profile.title');
    if (parent === 'strategies') return t('strategy.nav.overview');
    if (parent === 'scans') return t('brand.nav.scan');
    if (parent === 'briefs') return t('briefs.title');
  }
  let i = segments.length - 1;
  while (i >= 0 && isBrandRecordId(segments[i]!)) i--;
  if (i < 0) {
    if (segments.some((s) => isBrandRecordId(s))) {
      const parent = segments.find((s) => !isBrandRecordId(s));
      if (parent === 'profiles') return t('brand.profile.title');
      if (parent === 'strategies') return t('strategy.nav.overview');
      if (parent === 'scans') return t('brand.nav.scan');
      if (parent === 'briefs') return t('briefs.title');
    }
    return null;
  }
  const seg = segments[i]!;
  const i18nKey = BRAND_TRAIL_SEGMENT_KEYS[seg];
  if (i18nKey) {
    const label = t(i18nKey);
    if (label !== i18nKey) return label;
  }
  const navKey = `nav.${seg}`;
  const navLabel = t(navKey);
  if (navLabel !== navKey) return navLabel;
  return seg.replace(/[_.-]/g, ' ');
}

export type BrandWorkspaceNavMode = 'primary-only' | 'evidence-only' | 'strategy-only' | 'none';

export function isBrandDiscoverySection(pathname: string, brandId: string): boolean {
  const base = `/app/brands/${brandId}/discovery`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isBrandDeepWorkspaceRoute(pathname: string, brandId: string): boolean {
  if (isBrandStrategyDetailRoute(pathname, brandId)) return true;
  const base = `/app/brands/${brandId}`;
  if (!pathname.startsWith(`${base}/`)) return false;
  if (/\/profiles\/[^/]+/.test(pathname)) return true;
  if (/\/briefs\/[^/]+/.test(pathname)) return true;
  return false;
}

export function brandWorkspaceNavMode(pathname: string, brandId: string): BrandWorkspaceNavMode {
  if (isBrandDiscoverySection(pathname, brandId)) return 'none';
  if (isBrandDeepWorkspaceRoute(pathname, brandId)) return 'none';
  const base = `/app/brands/${brandId}`;
  if (pathname === base) return 'primary-only';
  const section = brandNavSection(pathname, brandId);
  if (section === 'evidence') return 'evidence-only';
  if (section === 'strategy') return 'strategy-only';
  return 'primary-only';
}

/** True when viewing a specific strategy (not the hub list or /new). */
export function isBrandStrategyDetailRoute(pathname: string, brandId: string): boolean {
  const prefix = `/app/brands/${brandId}/strategies/`;
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  if (!rest || rest.startsWith('new')) return false;
  return /^[^/]+/.test(rest);
}

export function brandNavSection(pathname: string, brandId: string): BrandNavSection {
  const base = `/app/brands/${brandId}`;
  if (pathname === base) return 'overview';
  if (pathname.includes('/settings')) return 'settings';
  if (
    pathname.includes('/connect') ||
    pathname.includes('/scans') ||
    pathname.includes('/discovery') ||
    pathname.includes('/seo') ||
    pathname.includes('/evidence')
  ) {
    return 'evidence';
  }
  if (
    pathname.includes('/profiles') ||
    pathname.includes('/strategies') ||
    pathname.includes('/briefs') ||
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
        p.includes('/profiles') ||
        p.includes('/strategies') ||
        p.includes('/briefs') ||
        p.includes('/intelligence'),
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
      id: 'evidence-hub',
      href: `${base}/evidence`,
      label: t('brand.nav.evidenceHub'),
      match: (p) => p.endsWith('/evidence'),
    },
    {
      id: 'discovery',
      href: `${base}/discovery`,
      label: t('brand.nav.discovery'),
      match: (p) => p.includes('/discovery') && !p.includes('/evidence'),
    },
    {
      id: 'seo',
      href: `${base}/seo`,
      label: t('brand.nav.seo'),
      match: (p) => p.includes('/seo'),
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
    {
      id: 'briefs',
      href: `${base}/briefs`,
      label: t('brand.nav.briefs'),
      match: (p) => p.includes('/briefs'),
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
    case 'plan':
      return `${base}/strategies`;
    case 'content':
      return '/app/content';
    default:
      return base;
  }
}
