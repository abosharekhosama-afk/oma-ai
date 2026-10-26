/* eslint-disable @typescript-eslint/no-explicit-any -- external WorkDrive JSON is read field by field and validated */
import { createHash } from 'node:crypto';
import type { FetchLike } from '../social/adapter';

/** Error from the WorkDrive integration API, normalised for OMA callers. */
export type WorkDriveErrorCode =
  | 'invalid_url'
  | 'invalid_key'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'too_large'
  | 'conflict'
  | 'unavailable'
  | 'bad_response';

export class WorkDriveError extends Error {
  constructor(
    readonly code: WorkDriveErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'WorkDriveError';
  }
  get retryable() {
    return this.code === 'rate_limited' || this.code === 'unavailable';
  }
}

const KEY_RE = /^wdk_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/;
export function isWorkDriveKey(v: unknown): v is string {
  return typeof v === 'string' && KEY_RE.test(v.trim());
}
/** Non-secret display form, e.g. `wdk_b7701f73243a…`. */
export function workDriveKeyPrefix(key: string) {
  return key.slice(0, 16);
}

/** https only (http allowed for localhost during development); no credentials, query or fragment. */
export function normalizeWorkDriveUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim())
    throw new WorkDriveError('invalid_url', 'URL required');
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new WorkDriveError('invalid_url', 'Invalid URL');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:'))
    throw new WorkDriveError('invalid_url', 'URL must use https');
  if (u.username || u.password || u.search || u.hash)
    throw new WorkDriveError('invalid_url', 'URL must not contain credentials or parameters');
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

export type WorkDriveSelf = {
  keyId: string;
  prefix: string;
  organization: { id: string; name: string };
  scopes: string[];
  rootFolder: { id: string; name: string } | null;
};
export type WorkDriveFolderEntry = { id: string; name: string };
export type WorkDriveFileEntry = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  updatedAt: string | null;
};
export type WorkDriveFolder = {
  id: string;
  name: string;
  parentId: string | null;
  folders: WorkDriveFolderEntry[];
  files: WorkDriveFileEntry[];
};
export type WorkDriveFileDetails = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
};
export type SignedUrl = { url: string; expiresAt: Date };

/**
 * Upload source. `full()` streams the whole body (single PUT); `part()` reads one byte range
 * (resumable sessions; at most one part is held in memory at a time).
 */
export type UploadSource = {
  size: number;
  full: () => ReadableStream<Uint8Array> | Uint8Array;
  part: (start: number, endExclusive: number) => Promise<Uint8Array>;
};

export const REQUIRED_SCOPES = ['files:read', 'files:write', 'folders:read', 'folders:write'];
/** Above this size uploads use resumable sessions. */
export const SINGLE_PUT_LIMIT = 32 * 1024 * 1024;
export const PART_SIZE = 16 * 1024 * 1024;

export function sha256Hex(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function str(v: unknown) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function num(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export class WorkDriveClient {
  readonly baseUrl: string;
  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i),
    private readonly opts: { timeoutMs?: number; singlePutLimit?: number; partSize?: number } = {},
  ) {
    this.baseUrl = normalizeWorkDriveUrl(baseUrl);
    if (!isWorkDriveKey(apiKey)) throw new WorkDriveError('invalid_key', 'Invalid WorkDrive key');
  }

  private async call(
    path: string,
    init: RequestInit = {},
    timeoutMs = this.opts.timeoutMs ?? 20_000,
  ) {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${this.apiKey}`);
    headers.set('accept', 'application/json');
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        redirect: 'manual',
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new WorkDriveError('unavailable', `WorkDrive unreachable: ${(e as Error).message}`);
    }
    if (!res.ok) await this.fail(res);
    return res;
  }

  private async fail(res: Response): Promise<never> {
    let msg = res.statusText || `HTTP ${res.status}`;
    try {
      const b = (await res.json()) as { message?: unknown };
      if (b?.message) msg = Array.isArray(b.message) ? b.message.join(', ') : str(b.message);
    } catch {
      /* not JSON */
    }
    const code: WorkDriveErrorCode =
      res.status === 401
        ? 'unauthorized'
        : res.status === 403
          ? 'forbidden'
          : res.status === 404
            ? 'not_found'
            : res.status === 409
              ? 'conflict'
              : res.status === 413
                ? 'too_large'
                : res.status === 429
                  ? 'rate_limited'
                  : res.status >= 500
                    ? 'unavailable'
                    : 'bad_response';
    throw new WorkDriveError(code, `WorkDrive: ${msg}`, res.status);
  }

  private async json<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.call(path, init);
    try {
      return (await res.json()) as T;
    } catch {
      throw new WorkDriveError('bad_response', 'WorkDrive returned an unexpected response');
    }
  }

  private post(path: string, body: unknown) {
    return this.json(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async self(): Promise<WorkDriveSelf> {
    const b = await this.json<Record<string, any>>('/integration/self');
    if (!b?.organization?.id) throw new WorkDriveError('bad_response', 'Not a WorkDrive server');
    return {
      keyId: str(b.keyId),
      prefix: str(b.prefix),
      organization: { id: str(b.organization.id), name: str(b.organization.name) },
      scopes: Array.isArray(b.scopes) ? b.scopes.map(str) : [],
      rootFolder: b.rootFolder?.id
        ? { id: str(b.rootFolder.id), name: str(b.rootFolder.name) }
        : null,
    };
  }

  async ensurePath(
    segments: string[],
    parentId?: string,
  ): Promise<{ folderId: string; path: WorkDriveFolderEntry[] }> {
    const b = await this.post('/folders/ensure-path', {
      segments,
      ...(parentId ? { parentId } : {}),
    });
    if (!b.folderId) throw new WorkDriveError('bad_response', 'Folder was not created');
    return {
      folderId: str(b.folderId),
      path: Array.isArray(b.path)
        ? (b.path as any[]).map((p) => ({ id: str(p.id), name: str(p.name) }))
        : [],
    };
  }

  async getFolder(id: string): Promise<WorkDriveFolder> {
    const b = await this.json<Record<string, any>>(`/folders/${encodeURIComponent(id)}`);
    return {
      id: str(b.id),
      name: str(b.name),
      parentId: b.parentId ? str(b.parentId) : null,
      folders: (Array.isArray(b.folders) ? b.folders : []).map((f: any) => ({
        id: str(f.id),
        name: str(f.name),
      })),
      files: (Array.isArray(b.files) ? b.files : [])
        .filter((f: any) => !f.deletedAt && (f.status ?? 'ACTIVE') === 'ACTIVE')
        .map((f: any) => ({
          id: str(f.id),
          name: str(f.name),
          mimeType: str(f.mimeType ?? f.mime_type) || 'application/octet-stream',
          size: num(f.size),
          updatedAt: f.updatedAt ? str(f.updatedAt) : null,
        })),
    };
  }

  async details(id: string): Promise<WorkDriveFileDetails> {
    const b = await this.json<Record<string, any>>(`/files/${encodeURIComponent(id)}/details`);
    return {
      id: str(b.id),
      name: str(b.name),
      mimeType: str(b.mimeType ?? b.mime_type) || 'application/octet-stream',
      size: num(b.size),
      folderId: b.location?.id ? str(b.location.id) : b.folderId ? str(b.folderId) : null,
    };
  }

  private signed(b: Record<string, unknown>, field: string): SignedUrl {
    const url = str(b[field]);
    if (!/^https?:\/\//.test(url))
      throw new WorkDriveError('bad_response', 'No signed URL returned');
    const secs = num(b.expires_in_seconds) || 900;
    return { url, expiresAt: new Date(Date.now() + secs * 1000) };
  }
  async previewUrl(id: string) {
    return this.signed(
      await this.json(`/files/${encodeURIComponent(id)}/preview-url`),
      'preview_url',
    );
  }
  async downloadUrl(id: string) {
    return this.signed(
      await this.json(`/files/${encodeURIComponent(id)}/download`),
      'download_url',
    );
  }
  /** Raw byte stream (supports HTTP Range) for video playback through the OMA API. */
  stream(id: string, range?: string | null) {
    return this.call(
      `/files/${encodeURIComponent(id)}/stream`,
      { headers: range ? { range } : {} },
      120_000,
    );
  }
  async trash(id: string) {
    await this.call(`/files/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  /** Upload into `folderId`. Small files: one signed PUT; big files: resumable parts. */
  async upload(input: {
    folderId: string;
    name: string;
    mimeType: string;
    sha256: string;
    source: UploadSource;
  }) {
    // WorkDrive refuses duplicate names in a folder: retry as "name (2).ext", "name (3).ext"…
    const dot = input.name.lastIndexOf('.');
    const base = dot > 0 ? input.name.slice(0, dot) : input.name;
    const ext = dot > 0 ? input.name.slice(dot) : '';
    for (let n = 1; ; n++) {
      const name = n === 1 ? input.name : `${base} (${n})${ext}`;
      try {
        return { ...(await this.uploadAs({ ...input, name })), name };
      } catch (e) {
        if (!(e instanceof WorkDriveError) || e.code !== 'conflict' || n >= 50) throw e;
      }
    }
  }

  private async uploadAs(input: {
    folderId: string;
    name: string;
    mimeType: string;
    sha256: string;
    source: UploadSource;
  }) {
    const { folderId, name, mimeType, sha256, source } = input;
    if (source.size <= (this.opts.singlePutLimit ?? SINGLE_PUT_LIMIT)) {
      const req = await this.post('/files/upload-request', {
        name,
        folder_id: folderId,
        size: source.size,
        mime_type: mimeType,
        sha256,
      });
      const uploadUrl = str(req.upload_url);
      if (!/^https?:\/\//.test(uploadUrl) || !req.upload_id)
        throw new WorkDriveError('bad_response', 'WorkDrive did not return an upload URL');
      let put: Response;
      try {
        // Signed URL: no Authorization header.
        put = await this.fetchImpl(uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': mimeType, 'content-length': String(source.size) },
          body: source.full() as RequestInit['body'],
          // Required by Node fetch for streamed bodies.
          ...({ duplex: 'half' } as object),
          signal: AbortSignal.timeout(30 * 60_000),
        });
      } catch (e) {
        throw new WorkDriveError('unavailable', `Upload failed: ${(e as Error).message}`);
      }
      if (!put.ok) await this.fail(put);
      const done = await this.post('/files/upload-complete', { upload_id: req.upload_id });
      return { fileId: str(done.file_id ?? done.id ?? req.file_id) };
    }
    const partSize = this.opts.partSize ?? PART_SIZE;
    const session = await this.post('/files/upload-sessions', {
      folderId,
      name,
      mimeType,
      size: source.size,
      sha256,
      partSize,
    });
    const sid = str(session.session_id);
    const size = num(session.part_size) || partSize;
    const total = num(session.total_parts) || Math.ceil(source.size / size);
    try {
      for (let n = 1; n <= total; n++) {
        const start = (n - 1) * size;
        const chunk = await source.part(start, Math.min(start + size, source.size));
        const form = new FormData();
        form.append(
          'chunk',
          new Blob([chunk as unknown as ArrayBuffer], { type: 'application/octet-stream' }),
          `${name}.part${n}`,
        );
        await this.call(
          `/files/upload-sessions/${sid}/parts/${n}`,
          { method: 'POST', headers: { 'x-part-sha256': sha256Hex(chunk) }, body: form },
          10 * 60_000,
        );
      }
      const done = await this.post(`/files/upload-sessions/${sid}/complete`, {});
      return { fileId: str(done.file_id ?? done.id ?? session.file_id) };
    } catch (e) {
      await this.call(`/files/upload-sessions/${sid}`, { method: 'DELETE' }).catch(() => undefined);
      throw e;
    }
  }
}
