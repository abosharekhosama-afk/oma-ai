import type { ObjectStoragePort } from '../ports/object-storage.port';
import type { WorkDrivePort } from '../ports/workdrive.port';
import { sha256Hex, WorkDriveClient, WorkDriveError } from './client';
import { safeFileName } from './layout';

/** Resolves the tenant's connected WorkDrive client, or null when the tenant has not connected. */
export type WorkDriveResolver = (tenantId: string) => Promise<{ client: WorkDriveClient } | null>;

async function need(resolve: WorkDriveResolver, tenantId: string) {
  const c = await resolve(tenantId);
  if (!c) throw new WorkDriveError('unauthorized', 'WorkDrive is not connected for this workspace');
  return c.client;
}

/** ObjectStoragePort backed by WorkDrive: `key` is a folder path + file name; externalRef = WorkDrive file id. */
export function workDriveObjectStorage(resolve: WorkDriveResolver, fetchImpl: typeof fetch = fetch): ObjectStoragePort {
  return {
    async putObject({ tenantId, key, bytes, contentType }) {
      const client = await need(resolve, tenantId);
      const parts = key.split('/').filter(Boolean);
      const name = safeFileName(parts.pop() ?? 'file');
      const { folderId } = await client.ensurePath(parts.length ? parts : ['OMA']);
      const checksum = sha256Hex(bytes);
      const { fileId } = await client.upload({
        folderId,
        name,
        mimeType: contentType,
        sha256: checksum,
        source: {
          size: bytes.byteLength,
          full: () => bytes,
          part: async (s, e) => bytes.subarray(s, e),
        },
      });
      return { externalRef: fileId, checksum };
    },
    async getObject({ tenantId, externalRef }) {
      const client = await need(resolve, tenantId);
      const { url } = await client.downloadUrl(externalRef);
      const res = await fetchImpl(url);
      if (!res.ok) throw new WorkDriveError('unavailable', `Download failed (${res.status})`, res.status);
      return new Uint8Array(await res.arrayBuffer());
    },
    async headObject({ tenantId, externalRef }) {
      const d = await (await need(resolve, tenantId)).details(externalRef);
      return { contentType: d.mimeType, size: d.size };
    },
    async deleteObject({ tenantId, externalRef }) {
      // Moves to WorkDrive trash (restorable there).
      await (await need(resolve, tenantId)).trash(externalRef);
    },
  };
}

/**
 * WorkDrivePort: OMA media already lives in WorkDrive, so `syncApproved` resolves the stored file id
 * (via `lookupFileId`) and confirms it still exists; `reconcile` reports present / missing.
 */
export function workDrivePort(
  resolve: WorkDriveResolver,
  lookupFileId: (tenantId: string, fileObjectRefId: string) => Promise<string | null>,
): WorkDrivePort {
  return {
    async mapFolder({ tenantId, contextPath }) {
      const segs = contextPath.split('/').filter(Boolean);
      const { folderId } = await (await need(resolve, tenantId)).ensurePath(segs);
      return { folderRef: folderId };
    },
    async syncApproved({ tenantId, fileObjectRefId }) {
      const fileId = await lookupFileId(tenantId, fileObjectRefId);
      if (!fileId) throw new WorkDriveError('not_found', 'File is not stored in WorkDrive');
      await (await need(resolve, tenantId)).details(fileId);
      return { externalRef: fileId };
    },
    async reconcile({ tenantId, externalRef }) {
      try {
        await (await need(resolve, tenantId)).details(externalRef);
        return { status: 'present' };
      } catch (e) {
        if (e instanceof WorkDriveError && e.code === 'not_found') return { status: 'missing' };
        throw e;
      }
    },
  };
}
