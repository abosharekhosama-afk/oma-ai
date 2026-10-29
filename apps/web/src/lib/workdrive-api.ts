import { api, ensureCsrfToken, friendlyApiMessage, invalidateApiCache } from './api';

export type WorkDriveStatus = {
  available: boolean;
  connected: boolean;
  default_url: string | null;
  max_video_mb: number;
  max_image_mb: number;
  connection: null | {
    base_url: string;
    key_prefix: string;
    org_name: string;
    root_folder: { id: string; name: string | null } | null;
    scopes: string[];
    status: 'CONNECTED' | 'ERROR';
    last_checked_at: string | null;
    last_error: string | null;
    connected_at: string;
  };
};

export type MediaKind = 'posts' | 'logos' | 'deliverables';
export type MediaAsset = {
  id: string;
  brand_id: string;
  kind: MediaKind;
  name: string;
  mime: string;
  size: number;
  status: 'READY' | 'MISSING';
  missing: boolean;
  source: string;
  view_url: string;
  stream_url: string | null;
  created_at: string;
};
export type MediaLibrary = {
  workdrive: {
    connected: boolean;
    available: boolean;
    max_video_mb: number;
    max_image_mb: number;
    org_name: string | null;
  };
  assets: MediaAsset[];
  next_cursor: string | null;
};
export type WorkDriveBrowse = {
  folder: { id: string; name: string; parent_id: string | null };
  root_name: string | null;
  folders: Array<{ id: string; name: string }>;
  files: Array<{ id: string; name: string; mime: string; size: number; updated_at: string | null }>;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const workDriveApi = {
  status: () => api<{ data: WorkDriveStatus }>('/api/v1/workspace/workdrive'),
  connect: (base_url: string, api_key: string) =>
    api<{ data: WorkDriveStatus }>(
      '/api/v1/workspace/workdrive',
      json('PUT', { base_url, api_key }),
    ),
  test: () => api<{ data: WorkDriveStatus }>('/api/v1/workspace/workdrive/test', json('POST', {})),
  disconnect: () => api<{ data: WorkDriveStatus }>('/api/v1/workspace/workdrive', json('DELETE')),
};

export const mediaApi = {
  list: (brandId: string, kind?: MediaKind) => {
    invalidateApiCache(`/api/v1/brands/${brandId}/media`);
    return api<{ data: MediaLibrary }>(
      `/api/v1/brands/${brandId}/media${kind ? `?kind=${kind}` : ''}`,
    );
  },
  browse: (
    brandId: string,
    kind: MediaKind,
    folderId?: string,
    scope: 'brand' | 'organization' = 'brand',
  ) =>
    api<{ data: WorkDriveBrowse }>(
      `/api/v1/brands/${brandId}/media/browse?kind=${kind}&scope=${scope}${folderId ? `&folder_id=${encodeURIComponent(folderId)}` : ''}`,
    ),
  importFile: (brandId: string, kind: MediaKind, fileId: string) =>
    api<{ data: MediaAsset }>(
      `/api/v1/brands/${brandId}/media/import`,
      json('POST', { kind, file_id: fileId }),
    ),
  /**
   * Uploads straight from the browser to WorkDrive storage:
   * 1. OMA API issues a short-lived signed PUT URL + grant (the WorkDrive key stays server-side),
   * 2. the browser PUTs the bytes to that URL (no Vercel proxy, so no 4.5 MB cap),
   * 3. OMA confirms with WorkDrive and records the asset.
   * If the direct PUT cannot reach storage (e.g. storage CORS not configured yet) and the file is
   * small enough for the proxy, it falls back to the streamed upload through the OMA API.
   */
  async upload(
    brandId: string,
    kind: MediaKind,
    file: File,
    onProgress?: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<MediaAsset> {
    const mime = file.type || 'application/octet-stream';
    const sha256 = await sha256Hex(file);
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { code: 'ABORTED' });
    const grant = await api<{
      data: { upload_url: string; headers: Record<string, string>; grant: string };
    }>(
      `/api/v1/brands/${brandId}/media/upload-grant`,
      json('POST', { kind, name: file.name, mime, size: file.size, sha256 }),
    );
    try {
      await xhrSend({
        url: grant.data.upload_url,
        method: 'PUT',
        headers: grant.data.headers,
        body: file,
        withCredentials: false,
        onProgress: (v) => onProgress?.(v * 0.97),
        signal,
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'ABORTED' || file.size > PROXY_LIMIT) throw e;
      return mediaApi.uploadViaApi(brandId, kind, file, onProgress, signal);
    }
    const done = await api<{ data: MediaAsset }>(
      '/api/v1/media/upload-complete',
      json('POST', { grant: grant.data.grant }),
    );
    onProgress?.(1);
    invalidateApiCache(`/api/v1/brands/${brandId}/media`);
    return done.data;
  },

  /** Streams the file through the OMA API (limited by the Vercel proxy to ~4.5 MB). */
  async uploadViaApi(
    brandId: string,
    kind: MediaKind,
    file: File,
    onProgress?: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<MediaAsset> {
    const qs = new URLSearchParams({ kind, name: file.name });
    const csrf = await ensureCsrfToken();
    const res = await xhrSend({
      url: `/api/v1/brands/${brandId}/media?${qs}`,
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      body: file,
      withCredentials: true,
      onProgress,
      signal,
    });
    const data = res as { data?: MediaAsset };
    if (!data.data) throw new Error(friendlyApiMessage(undefined, 500));
    invalidateApiCache(`/api/v1/brands/${brandId}/media`);
    return data.data;
  },
};

/** Bytes the Vercel /api proxy accepts in one request body (platform cap ~4.5 MB). */
const PROXY_LIMIT = 4 * 1024 * 1024;

async function sha256Hex(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function xhrSend(opts: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Blob;
  withCredentials: boolean;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url);
    xhr.withCredentials = opts.withCredentials;
    for (const [k, v] of Object.entries(opts.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };
    opts.signal?.addEventListener('abort', () => xhr.abort());
    xhr.onabort = () => reject(Object.assign(new Error('aborted'), { code: 'ABORTED' }));
    xhr.onerror = () =>
      reject(
        Object.assign(new Error(friendlyApiMessage({ code: 'NETWORK' }, 0)), {
          status: 0,
          code: 'NETWORK',
        }),
      );
    xhr.onload = () => {
      let data: { error?: { code?: string; message_key?: string } } = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        /* storage responses may be empty or XML */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else
        reject(
          Object.assign(new Error(friendlyApiMessage(data.error, xhr.status)), {
            status: xhr.status,
            code: data.error?.code ?? 'HTTP',
          }),
        );
    };
    xhr.send(opts.body);
  });
}

export function formatBytes(n: number, locale: string) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i ? 1 : 0 }).format(v)} ${units[i]}`;
}
