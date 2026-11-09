import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  copyBufferAllowed,
  copyMaxBufferBytes,
  copyRequiresFullBuffer,
  copyTransferMode,
  WorkDriveClient,
} from '@oma/domain';
import { fakeKey, startFakeWorkDrive } from '../helpers/fake-workdrive';

describe('streaming storage copy', () => {
  it('chooses a streamed PUT vs ranged sessions and never requires a full-object buffer', () => {
    expect(copyTransferMode(1024, 32 * 1024 * 1024)).toBe('put');
    expect(copyTransferMode(33 * 1024 * 1024, 32 * 1024 * 1024)).toBe('session');
    expect(copyRequiresFullBuffer(40 * 1024 * 1024, null)).toBe(false);
    expect(copyBufferAllowed(40 * 1024 * 1024, null, 32 * 1024 * 1024)).toBe(false);
    expect(copyMaxBufferBytes({ STORAGE_COPY_MAX_BUFFER_BYTES: '1048576' })).toBe(1048576);
  });

  describe('uploadFromSignedSource', () => {
    const key = fakeKey('s');
    let wd: Awaited<ReturnType<typeof startFakeWorkDrive>>;

    beforeAll(async () => {
      wd = await startFakeWorkDrive({ key, rootName: 'OMA' });
    });
    afterAll(async () => {
      await wd.close();
    });

    it('uses Range requests and keeps each part at or below the part size', async () => {
      const client = new WorkDriveClient(wd.baseUrl, key);
      const bytes = Buffer.alloc(12, 7);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const folder = await client.ensurePath(['tenants', 't1', 'copy']);
      const requested = await client.requestUpload({
        folderId: folder.folderId,
        name: 'src.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        sha256,
      });
      const put = await fetch(requested.uploadUrl, { method: 'PUT', body: bytes });
      expect(put.ok || put.status === 204).toBe(true);
      await client.completeUpload(requested.uploadId);
      const signed = await client.downloadUrl(requested.fileId);
      const dest = await client.ensurePath(['tenants', 't1', 'dest']);
      const copied = await client.uploadFromSignedSource({
        folderId: dest.folderId,
        name: 'dest.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        sha256,
        sourceUrl: signed.url,
        singlePutLimit: 5,
        partSize: 5,
      });
      expect(copied.mode).toBe('session');
      expect(copied.maxChunkBytes).toBeLessThanOrEqual(5);
      expect(copied.fileId).toBeTruthy();
      expect(
        wd.calls.some((c) => c.path === '/storage/objects' && c.range?.startsWith('bytes=')),
      ).toBe(true);
    });

    it('stream-hashes while copying when sha256 is omitted', async () => {
      const client = new WorkDriveClient(wd.baseUrl, key);
      const bytes = Buffer.from('stream-hash-me');
      const expected = createHash('sha256').update(bytes).digest('hex');
      const folder = await client.ensurePath(['tenants', 't1', 'src-nohash']);
      const requested = await client.requestUpload({
        folderId: folder.folderId,
        name: 'plain.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
      });
      const put = await fetch(requested.uploadUrl, { method: 'PUT', body: bytes });
      expect(put.ok || put.status === 204).toBe(true);
      const completed = await client.completeUpload(requested.uploadId);
      expect(completed.sha256).toBe(expected);
      const signed = await client.downloadUrl(requested.fileId);
      const dest = await client.ensurePath(['tenants', 't1', 'dest-nohash']);
      const copied = await client.uploadFromSignedSource({
        folderId: dest.folderId,
        name: 'copied.bin',
        mimeType: 'application/octet-stream',
        size: bytes.length,
        sourceUrl: signed.url,
      });
      expect(copied.sha256).toBe(expected);
      expect(copied.mode).toBe('put');
    });
  });
});
