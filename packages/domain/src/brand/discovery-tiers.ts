export const DISCOVERY_TIERS = [
  'REQUIRED_FOR_APPROVAL',
  'DISCOVER_WHEN_AVAILABLE',
  'DEFERRED_ADVANCED',
] as const;
export type DiscoveryTier = (typeof DISCOVERY_TIERS)[number];

const FIELD_TIER_MAP: Record<string, DiscoveryTier> = {
  'brand.name': 'REQUIRED_FOR_APPROVAL',
  'brand.source_url': 'REQUIRED_FOR_APPROVAL',
  'brand.description': 'DISCOVER_WHEN_AVAILABLE',
  'brand.categories': 'DISCOVER_WHEN_AVAILABLE',
  'brand.languages': 'DISCOVER_WHEN_AVAILABLE',
  'brand.contact': 'DISCOVER_WHEN_AVAILABLE',
  'brand.social': 'DISCOVER_WHEN_AVAILABLE',
  'catalog.products': 'DISCOVER_WHEN_AVAILABLE',
  'catalog.services': 'DISCOVER_WHEN_AVAILABLE',
  'brand.audiences': 'DISCOVER_WHEN_AVAILABLE',
  'brand.messaging': 'DISCOVER_WHEN_AVAILABLE',
  'brand.tone': 'DISCOVER_WHEN_AVAILABLE',
  'brand.logo': 'DISCOVER_WHEN_AVAILABLE',
  'brand.colors': 'DISCOVER_WHEN_AVAILABLE',
  'brand.visual_identity': 'DISCOVER_WHEN_AVAILABLE',
};

export function discoveryTierForField(fieldKey: string): DiscoveryTier {
  return FIELD_TIER_MAP[fieldKey] ?? 'DISCOVER_WHEN_AVAILABLE';
}

export function isRequiredForApproval(fieldKey: string): boolean {
  return discoveryTierForField(fieldKey) === 'REQUIRED_FOR_APPROVAL';
}
