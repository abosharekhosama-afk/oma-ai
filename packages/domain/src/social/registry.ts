import type { FetchLike, SocialNetworkCode, SocialProviderAdapter } from './adapter';
import { SOCIAL_NETWORKS } from './adapter';
import { LinkedInAdapter } from './linkedin.adapter';
import { MetaAdapter } from './meta.adapter';
import { TikTokAdapter } from './tiktok.adapter';
import { XAdapter } from './x.adapter';
import { tokenKeyFromEnv } from './token-crypto';

export function createSocialAdapter(
  network: SocialNetworkCode,
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: FetchLike = fetch,
): SocialProviderAdapter {
  switch (network) {
    case 'facebook':
    case 'instagram':
      return new MetaAdapter(network, env, fetchFn);
    case 'linkedin':
      return new LinkedInAdapter(env, fetchFn);
    case 'tiktok':
      return new TikTokAdapter(env, fetchFn);
    case 'x':
      return new XAdapter(env, fetchFn);
  }
}

export type ProviderAvailability = {
  network: SocialNetworkCode;
  available: boolean;
  /** Why it is unavailable: app keys missing, or token encryption key missing. */
  reason: 'not_configured' | 'encryption_key_missing' | null;
};

export function socialAvailability(env: NodeJS.ProcessEnv = process.env): ProviderAvailability[] {
  const keyOk = Boolean(tokenKeyFromEnv(env));
  return SOCIAL_NETWORKS.map((network) => {
    const configured = createSocialAdapter(network, env).isConfigured();
    return {
      network,
      available: configured && keyOk,
      reason: !configured ? 'not_configured' : !keyOk ? 'encryption_key_missing' : null,
    };
  });
}

/** Prisma enum <-> API code. */
export const toSocialEnum = (n: SocialNetworkCode) =>
  n.toUpperCase() as 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK' | 'X';
export const fromSocialEnum = (n: string) => n.toLowerCase() as SocialNetworkCode;
