import type { SocialNetworkCode } from './adapter';
import { SOCIAL_NETWORKS, isSocialNetwork } from './adapter';

/** Customer-facing product does not offer these networks (paid API / paused). */
export const PRODUCT_DISABLED_SOCIAL_NETWORKS = ['x'] as const;
export type ProductDisabledSocialNetwork = (typeof PRODUCT_DISABLED_SOCIAL_NETWORKS)[number];

export function isSocialNetworkProductDisabled(network: string): boolean {
  const key = network.trim().toLowerCase();
  return (PRODUCT_DISABLED_SOCIAL_NETWORKS as readonly string[]).includes(key);
}

export function isCustomerOfferedSocialNetwork(network: unknown): network is SocialNetworkCode {
  return isSocialNetwork(network) && !isSocialNetworkProductDisabled(network);
}

export const CUSTOMER_SOCIAL_NETWORKS = SOCIAL_NETWORKS.filter(
  (n) => !isSocialNetworkProductDisabled(n),
) as Exclude<SocialNetworkCode, ProductDisabledSocialNetwork>[];
