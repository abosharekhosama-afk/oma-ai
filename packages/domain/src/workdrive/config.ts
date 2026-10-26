import { decryptToken, parseEncryptionKey } from '../social/token-crypto';
import type { FetchLike } from '../social/adapter';
import { WorkDriveClient } from './client';
import { DEFAULT_MAX_IMAGE_BYTES, DEFAULT_MAX_VIDEO_BYTES } from './layout';

/** Encryption key for stored WorkDrive keys: WORKDRIVE_ENCRYPTION_KEY, else SOCIAL_TOKEN_ENCRYPTION_KEY. */
export function workDriveSecretKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  return (
    parseEncryptionKey(env.WORKDRIVE_ENCRYPTION_KEY) ??
    parseEncryptionKey(env.SOCIAL_TOKEN_ENCRYPTION_KEY)
  );
}

function mb(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n * 1024 * 1024) : fallback;
}

export function workDriveLimits(env: NodeJS.ProcessEnv = process.env) {
  return {
    maxVideoBytes: mb(env.WORKDRIVE_MAX_VIDEO_MB, DEFAULT_MAX_VIDEO_BYTES),
    maxImageBytes: mb(env.WORKDRIVE_MAX_IMAGE_MB, DEFAULT_MAX_IMAGE_BYTES),
  };
}

export function maxBytesForMime(mime: string, env: NodeJS.ProcessEnv = process.env) {
  const l = workDriveLimits(env);
  return mime.startsWith('video/') ? l.maxVideoBytes : mime.startsWith('image/') ? l.maxImageBytes : l.maxImageBytes;
}

/** Default shown in the connect form; the workspace can change it. */
export function workDriveDefaultUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.WORKDRIVE_DEFAULT_URL?.trim() || '';
}

export function clientFromConnection(
  conn: { baseUrl: string; apiKeyEnc: string },
  key: Buffer,
  fetchImpl?: FetchLike,
) {
  return new WorkDriveClient(conn.baseUrl, decryptToken(conn.apiKeyEnc, key), fetchImpl);
}
