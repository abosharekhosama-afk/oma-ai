import { SINGLE_PUT_LIMIT } from './client';

/** Refuse to buffer a whole object larger than this when no sha256 is stored. */
export const DEFAULT_COPY_MAX_BUFFER_BYTES = Number(
  process.env.STORAGE_COPY_MAX_BUFFER_BYTES || 32 * 1024 * 1024,
);

export function copyMaxBufferBytes(env: NodeJS.ProcessEnv = process.env) {
  const n = Number(env.STORAGE_COPY_MAX_BUFFER_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_COPY_MAX_BUFFER_BYTES;
}

/** True when the copy must download the object once to compute sha256. */
export function copyRequiresFullBuffer(size: number, sha256?: string | null) {
  return !sha256;
}

export function copyBufferAllowed(size: number, sha256?: string | null, maxBuffer?: number) {
  if (sha256) return false;
  return size <= (maxBuffer ?? copyMaxBufferBytes());
}

/** Streamed PUT vs ranged upload-sessions (one part in memory). */
export function copyTransferMode(
  size: number,
  singlePutLimit = SINGLE_PUT_LIMIT,
): 'put' | 'session' {
  return size <= singlePutLimit ? 'put' : 'session';
}
