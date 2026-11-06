import type { FetchLike, SocialNetworkCode, SocialProviderAdapter } from './adapter';
import { SOCIAL_NETWORKS } from './adapter';
import { LinkedInAdapter } from './linkedin.adapter';
import { MetaAdapter } from './meta.adapter';
import { TikTokAdapter } from './tiktok.adapter';
import { WhatsAppAdapter } from './whatsapp.adapter';
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
    case 'whatsapp':
      return new WhatsAppAdapter(env, fetchFn);
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

export type NetworkReadiness = ProviderAvailability & {
  inbox: boolean;
  feed_publish: boolean;
  webhooks: boolean;
  missing_env: string[];
};

export function socialReadiness(env: NodeJS.ProcessEnv = process.env): NetworkReadiness[] {
  const keyOk = Boolean(tokenKeyFromEnv(env));
  return SOCIAL_NETWORKS.map((network) => {
    const adapter = createSocialAdapter(network, env);
    const missing = adapter.requiredEnv.filter((k) => !String(env[k] ?? '').trim());
    if (!keyOk && !missing.includes('SOCIAL_TOKEN_ENCRYPTION_KEY')) {
      missing.push('SOCIAL_TOKEN_ENCRYPTION_KEY');
    }
    const configured = adapter.isConfigured();
    return {
      network,
      available: configured && keyOk,
      reason: !configured ? 'not_configured' : !keyOk ? 'encryption_key_missing' : null,
      inbox: true,
      feed_publish: network !== 'whatsapp',
      webhooks: true,
      missing_env: missing,
    };
  });
}

/** Prisma enum <-> API code. */
export const toSocialEnum = (n: SocialNetworkCode) =>
  n.toUpperCase() as 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK' | 'X' | 'WHATSAPP';
export const fromSocialEnum = (n: string) => n.toLowerCase() as SocialNetworkCode;
