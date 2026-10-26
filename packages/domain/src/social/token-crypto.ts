import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM encryption for social tokens at rest.
 * Key: SOCIAL_TOKEN_ENCRYPTION_KEY = 32 bytes as base64 (44 chars) or hex (64 chars).
 * Format: v1.<iv b64url>.<auth tag b64url>.<ciphertext b64url>
 */
export class TokenCryptoError extends Error {}

export function parseEncryptionKey(raw: string | undefined | null): Buffer | null {
  if (!raw) return null;
  const v = raw.trim();
  let key: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) key = Buffer.from(v, 'hex');
  else {
    try {
      const b = Buffer.from(v, 'base64');
      if (b.length === 32) key = b;
    } catch {
      key = null;
    }
  }
  return key && key.length === 32 ? key : null;
}

export function tokenKeyFromEnv(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  return parseEncryptionKey(env.SOCIAL_TOKEN_ENCRYPTION_KEY);
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(
    '.',
  );
}

export function decryptToken(enc: string, key: Buffer): string {
  const [v, iv, tag, ct] = enc.split('.');
  if (v !== 'v1' || !iv || !tag || ct === undefined) throw new TokenCryptoError('Malformed token');
  try {
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  } catch {
    throw new TokenCryptoError('Token could not be decrypted (wrong key or tampered)');
  }
}

/** PKCE helpers (RFC 7636, S256). */
export function pkceVerifier(): string {
  return randomBytes(48).toString('base64url');
}
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
