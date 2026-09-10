export const INTEGRATION_HONESTY = {
  AD_PLATFORM_NOT_CONNECTED: 'AD_PLATFORM_NOT_CONNECTED',
  KEYWORD_PROVIDER_DEFERRED: 'KEYWORD_PROVIDER_DEFERRED',
} as const;

export function adPlatformHonestyMessage(): string {
  return 'Ad platforms are not connected in Feature 003. Paid budgets are planning data only.';
}
