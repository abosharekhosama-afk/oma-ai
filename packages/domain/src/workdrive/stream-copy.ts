import { createHash } from 'node:crypto';
import { SINGLE_PUT_LIMIT } from './client';

/**
 * Kept for env compatibility. Copies no longer fail or fully buffer when sha256 is
 * missing — they stream-hash instead.
 */
export const DEFAULT_COPY_MAX_BUFFER_BYTES = Number(
  process.env.STORAGE_COPY_MAX_BUFFER_BYTES || 32 * 1024 * 1024,
);

export function copyMaxBufferBytes(env: NodeJS.ProcessEnv = process.env) {
  const n = Number(env.STORAGE_COPY_MAX_BUFFER_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_COPY_MAX_BUFFER_BYTES;
}

/** Full-object buffering is never required: sha256 is computed while streaming. */
export function copyRequiresFullBuffer(_size: number, _sha256?: string | null) {
  return false;
}

/** Never take the old “download then hash” path. */
export function copyBufferAllowed(_size: number, _sha256?: string | null, _maxBuffer?: number) {
  return false;
}

/** Streamed PUT vs ranged upload-sessions (one part in memory). */
export function copyTransferMode(
  size: number,
  singlePutLimit = SINGLE_PUT_LIMIT,
): 'put' | 'session' {
  return size <= singlePutLimit ? 'put' : 'session';
}

/** Hash bytes as they pass through a web stream (one pass, no extra buffer of the whole object). */
export function hashingByteStream(source: ReadableStream<Uint8Array>) {
  const hash = createHash('sha256');
  const reader = source.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      hash.update(value);
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return { stream, digest: () => hash.digest('hex') };
}
