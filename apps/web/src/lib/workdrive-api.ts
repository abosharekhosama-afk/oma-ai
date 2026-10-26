import { api, friendlyApiMessage, invalidateApiCache } from './api';

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
    api<{ data: WorkDriveStatus }>('/api/v1/workspace/workdrive', json('PUT', { base_url, api_key })),
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
  browse: (brandId: string, kind: MediaKind, folderId?: string) =>
    api<{ data: WorkDriveBrowse }>(
      `/api/v1/brands/${brandId}/media/browse?kind=${kind}${folderId ? `&folder_id=${encodeURIComponent(folderId)}` : ''}`,
    ),
  importFile: (brandId: string, kind: MediaKind, fileId: string) =>
    api<{ data: MediaAsset }>(
      `/api/v1/brands/${brandId}/media/import`,
      json('POST', { kind, file_id: fileId }),
    ),
  /** Sends the file as the raw request body (streamed by the API to WorkDrive). */
  upload(
    brandId: string,
    kind: MediaKind,
    file: File,
    onProgress?: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<MediaAsset> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const qs = new URLSearchParams({ kind, name: file.name });
      xhr.open('POST', `/api/v1/brands/${brandId}/media?${qs}`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
      const csrf = document.cookie
        .split('; ')
        .find((c) => c.startsWith('oma_csrf='))
        ?.split('=')[1];
      if (csrf) xhr.setRequestHeader('x-csrf-token', decodeURIComponent(csrf));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total);
      };
      signal?.addEventListener('abort', () => xhr.abort());
      xhr.onabort = () => reject(Object.assign(new Error('aborted'), { code: 'ABORTED' }));
      xhr.onerror = () =>
        reject(
          Object.assign(new Error(friendlyApiMessage({ code: 'NETWORK' }, 0)), { status: 0 }),
        );
      xhr.onload = () => {
        let data: { data?: MediaAsset; error?: { code?: string; message_key?: string } } = {};
        try {
          data = JSON.parse(xhr.responseText || '{}');
        } catch {
          /* empty */
        }
        if (xhr.status >= 200 && xhr.status < 300 && data.data) {
          invalidateApiCache(`/api/v1/brands/${brandId}/media`);
          resolve(data.data);
        } else
          reject(
            Object.assign(new Error(friendlyApiMessage(data.error, xhr.status)), {
              status: xhr.status,
              code: data.error?.code,
            }),
          );
      };
      xhr.send(file);
    });
  },
};

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
