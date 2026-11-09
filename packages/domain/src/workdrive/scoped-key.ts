import { encryptToken, decryptToken } from '../social/token-crypto';
import type { FetchLike } from '../social/adapter';
import { REQUIRED_SCOPES, WorkDriveClient, WorkDriveError } from './client';

export const KEYS_MANAGE_SCOPE = 'keys:manage';
export const PLATFORM_CHILD_SCOPES = [...REQUIRED_SCOPES];

export function tenantScopedKeyName(tenantId: string) {
  return `oma-tenant-${tenantId}`;
}

export type StoredPlatformKey = {
  platformKeyEnc: string | null;
  platformKeyPrefix: string | null;
  platformKeyId: string | null;
  platformRootFolderId: string | null;
  platformKeyStatus: string | null;
};

export type PlatformKeyStore = {
  get(tenantId: string): Promise<StoredPlatformKey | null>;
  save(tenantId: string, data: StoredPlatformKey): Promise<void>;
};

export type MintedScopedKey = {
  apiKey: string;
  keyId: string;
  prefix: string;
  rootFolderId: string;
};

export async function mintTenantScopedKey(
  master: WorkDriveClient,
  tenantId: string,
): Promise<MintedScopedKey | 'unsupported'> {
  let self;
  try {
    self = await master.self();
  } catch {
    return 'unsupported';
  }
  if (!self.scopes.includes(KEYS_MANAGE_SCOPE)) return 'unsupported';
  try {
    const { folderId } = await master.ensurePath(['tenants', tenantId]);
    const minted = await master.mintKey({
      name: tenantScopedKeyName(tenantId),
      rootFolderId: folderId,
      scopes: PLATFORM_CHILD_SCOPES,
    });
    return {
      apiKey: minted.secret,
      keyId: minted.keyId,
      prefix: minted.prefix,
      rootFolderId: minted.rootFolderId || folderId,
    };
  } catch (e) {
    if (
      e instanceof WorkDriveError &&
      (e.code === 'outdated' || e.code === 'not_found' || e.code === 'forbidden')
    ) {
      return 'unsupported';
    }
    throw e;
  }
}

export async function ensurePlatformScopedKey(input: {
  tenantId: string;
  master: WorkDriveClient;
  secret: Buffer;
  store: PlatformKeyStore;
}): Promise<StoredPlatformKey | null> {
  const existing = await input.store.get(input.tenantId);
  if (existing?.platformKeyStatus === 'active' && existing.platformKeyEnc) return existing;
  if (existing?.platformKeyStatus === 'unsupported') return existing;
  const minted = await mintTenantScopedKey(input.master, input.tenantId);
  if (minted === 'unsupported') {
    const next: StoredPlatformKey = {
      platformKeyEnc: existing?.platformKeyEnc ?? null,
      platformKeyPrefix: existing?.platformKeyPrefix ?? null,
      platformKeyId: existing?.platformKeyId ?? null,
      platformRootFolderId: existing?.platformRootFolderId ?? null,
      platformKeyStatus: 'unsupported',
    };
    await input.store.save(input.tenantId, next);
    return next;
  }
  const next: StoredPlatformKey = {
    platformKeyEnc: encryptToken(minted.apiKey, input.secret),
    platformKeyPrefix: minted.prefix,
    platformKeyId: minted.keyId,
    platformRootFolderId: minted.rootFolderId,
    platformKeyStatus: 'active',
  };
  await input.store.save(input.tenantId, next);
  return next;
}

export function clientFromPlatformKey(
  baseUrl: string,
  enc: string,
  secret: Buffer,
  fetchImpl?: FetchLike,
) {
  return new WorkDriveClient(baseUrl, decryptToken(enc, secret), fetchImpl);
}

export async function revokePlatformKeyForTenant(input: {
  tenantId: string;
  master: WorkDriveClient;
  store: PlatformKeyStore;
}): Promise<void> {
  const existing = await input.store.get(input.tenantId);
  const id = existing?.platformKeyId;
  if (id) {
    await input.master.revokeChildKey(id).catch(() => undefined);
  } else {
    await revokeMintedKeyByTenantName(input.master, input.tenantId);
  }
  await input.store.save(input.tenantId, {
    platformKeyEnc: null,
    platformKeyPrefix: null,
    platformKeyId: null,
    platformRootFolderId: existing?.platformRootFolderId ?? null,
    platformKeyStatus: 'revoked',
  });
}

export async function revokeMintedKeyByTenantName(master: WorkDriveClient, tenantId: string) {
  const name = tenantScopedKeyName(tenantId);
  const keys = await master.listChildKeys().catch(() => []);
  const match = keys.find((k) => k.name === name && !k.revokedAt);
  if (match) await master.revokeChildKey(match.id).catch(() => undefined);
}
