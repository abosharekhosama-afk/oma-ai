import { describe, expect, it } from 'vitest';
import {
  brandFolderSlug,
  decryptToken,
  encryptToken,
  isWorkDriveKey,
  mediaFolderSegments,
  normalizeWorkDriveUrl,
  safeFileName,
  sha256Hex,
  WorkDriveClient,
  WorkDriveError,
  workDriveLimits,
  workDriveObjectStorage,
  workDrivePort,
  workDriveSecretKey,
  type FetchLike,
} from '@oma/domain';
import { decodeImageDataUrl } from '../../apps/worker/src/media/media-jobs';

const KEY = `wdk_0123456789ab_${'K'.repeat(43)}`;
const BASE = 'https://wd.example.com';
type Call = { url: string; init?: RequestInit };
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

function mock(routes: Array<[RegExp, (c: Call) => Response | Promise<Response>]>) {
  const calls: Call[] = [];
  const fn: FetchLike = async (url, init) => {
    const c = { url: String(url), init };
    calls.push(c);
    const r = routes.find(([re]) => re.test(`${init?.method ?? 'GET'} ${c.url}`));
    if (!r) throw new Error(`unexpected ${init?.method ?? 'GET'} ${c.url}`);
    return r[1](c);
  };
  return { fn, calls };
}
const auth = (c: Call) => new Headers(c.init?.headers).get('authorization');

describe('WorkDrive client (mocked HTTP)', () => {
  it('validates the URL and key before any request', () => {
    expect(normalizeWorkDriveUrl('https://wd.example.com/')).toBe('https://wd.example.com');
    expect(normalizeWorkDriveUrl('http://127.0.0.1:4100')).toBe('http://127.0.0.1:4100');
    for (const bad of [
      'http://wd.example.com',
      'ftp://x',
      'https://u:p@wd.example.com',
      'https://wd.example.com/?a=1',
      '',
      'not a url',
    ])
      expect(() => normalizeWorkDriveUrl(bad)).toThrow(WorkDriveError);
    expect(isWorkDriveKey(KEY)).toBe(true);
    expect(isWorkDriveKey('wdk_short')).toBe(false);
    expect(() => new WorkDriveClient(BASE, 'nope')).toThrow(/Invalid WorkDrive key/);
  });

  it('sends the key as a Bearer token and parses /integration/self', async () => {
    const m = mock([
      [
        /GET .*\/integration\/self$/,
        () =>
          json({
            keyId: 'k',
            prefix: 'wdk_0123456789ab',
            organization: { id: 'o', name: 'Imkan Studio' },
            scopes: ['files:read'],
            rootFolder: { id: 'r', name: 'OMA' },
          }),
      ],
    ]);
    const s = await new WorkDriveClient(BASE, KEY, m.fn).self();
    expect(s).toMatchObject({
      organization: { name: 'Imkan Studio' },
      rootFolder: { name: 'OMA' },
    });
    expect(auth(m.calls[0]!)).toBe(`Bearer ${KEY}`);
  });

  it('maps HTTP errors to typed codes', async () => {
    const m = mock([
      [/\/integration\/self$/, () => json({ message: 'Invalid integration key' }, 401)],
      [/\/files\/gone\/details$/, () => json({ message: 'File not found' }, 404)],
      [/\/files\/busy\/details$/, () => json({ message: 'slow down' }, 429)],
      [/\/files\/down\/details$/, () => json({}, 503)],
    ]);
    const c = new WorkDriveClient(BASE, KEY, m.fn);
    await expect(c.self()).rejects.toMatchObject({ code: 'unauthorized', status: 401 });
    await expect(c.details('gone')).rejects.toMatchObject({ code: 'not_found' });
    const busy = await c.details('busy').catch((e) => e);
    expect(busy).toMatchObject({ code: 'rate_limited', retryable: true });
    await expect(c.details('down')).rejects.toMatchObject({ code: 'unavailable', retryable: true });
    const offline = new WorkDriveClient(BASE, KEY, async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(offline.self()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('single upload: upload-request with sha256 → signed PUT without the key → complete', async () => {
    const bytes = new TextEncoder().encode('hello world');
    const m = mock([
      [
        /POST .*\/files\/upload-request$/,
        () =>
          json(
            {
              upload_url: 'https://objects.example.com/put?token=t',
              upload_id: 'u1',
              file_id: 'f1',
            },
            201,
          ),
      ],
      [/PUT https:\/\/objects\.example\.com\/put/, () => new Response(null, { status: 204 })],
      [/POST .*\/files\/upload-complete$/, () => json({ file_id: 'f1', status: 'complete' }, 201)],
    ]);
    const r = await new WorkDriveClient(BASE, KEY, m.fn).upload({
      folderId: 'fold',
      name: 'post.png',
      mimeType: 'image/png',
      sha256: sha256Hex(bytes),
      source: { size: bytes.length, full: () => bytes, part: async (s, e) => bytes.subarray(s, e) },
    });
    expect(r.fileId).toBe('f1');
    const req = JSON.parse(String(m.calls[0]!.init!.body));
    expect(req).toEqual({
      name: 'post.png',
      folder_id: 'fold',
      size: 11,
      mime_type: 'image/png',
      sha256: sha256Hex(bytes),
    });
    expect(auth(m.calls[1]!)).toBeNull();
    expect(JSON.parse(String(m.calls[2]!.init!.body))).toEqual({ upload_id: 'u1' });
  });

  it('large upload uses resumable parts with per-part sha256 and aborts on failure', async () => {
    const bytes = new Uint8Array(25).map((_, i) => i);
    let fail = false;
    const m = mock([
      [
        /POST .*\/files\/upload-sessions$/,
        () => json({ session_id: 's1', file_id: 'f2', part_size: 10, total_parts: 3 }, 201),
      ],
      [
        /POST .*\/upload-sessions\/s1\/parts\/\d$/,
        (c) => (fail && c.url.endsWith('/2') ? json({ message: 'boom' }, 500) : json({}, 201)),
      ],
      [/POST .*\/upload-sessions\/s1\/complete$/, () => json({ file_id: 'f2' }, 201)],
      [/DELETE .*\/upload-sessions\/s1$/, () => json({ aborted: true })],
    ]);
    const c = new WorkDriveClient(BASE, KEY, m.fn, { singlePutLimit: 8, partSize: 10 });
    const input = {
      folderId: 'f',
      name: 'v.mp4',
      mimeType: 'video/mp4',
      sha256: sha256Hex(bytes),
      source: {
        size: 25,
        full: () => bytes,
        part: async (s: number, e: number) => bytes.subarray(s, e),
      },
    };
    expect((await c.upload(input)).fileId).toBe('f2');
    const parts = m.calls.filter((x) => /parts\/\d$/.test(x.url));
    expect(parts).toHaveLength(3);
    expect(new Headers(parts[2]!.init!.headers).get('x-part-sha256')).toBe(
      sha256Hex(bytes.subarray(20, 25)),
    );
    expect(parts[0]!.init!.body).toBeInstanceOf(FormData);
    fail = true;
    await expect(c.upload(input)).rejects.toMatchObject({ code: 'unavailable' });
    expect(m.calls.at(-1)!.init!.method).toBe('DELETE');
  });

  it('signed preview/download URLs and folder listings', async () => {
    const m = mock([
      [
        /\/files\/f1\/preview-url$/,
        () => json({ preview_url: 'https://o/x?token=p', expires_in_seconds: 900 }),
      ],
      [
        /\/files\/f1\/download$/,
        () => json({ download_url: 'https://o/x?token=d', expires_in_seconds: 60 }),
      ],
      [
        /\/folders\/d1$/,
        () =>
          json({
            id: 'd1',
            name: 'posts',
            parentId: 'p',
            folders: [{ id: 'c', name: 'sub' }],
            files: [
              { id: 'f1', name: 'a.png', mimeType: 'image/png', size: '42', status: 'ACTIVE' },
              { id: 'f9', name: 'gone.png', mimeType: 'image/png', size: '1', status: 'TRASHED' },
            ],
          }),
      ],
    ]);
    const c = new WorkDriveClient(BASE, KEY, m.fn);
    expect((await c.previewUrl('f1')).url).toBe('https://o/x?token=p');
    const d = await c.downloadUrl('f1');
    expect(d.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
    const f = await c.getFolder('d1');
    expect(f.files).toEqual([
      { id: 'f1', name: 'a.png', mimeType: 'image/png', size: 42, updatedAt: null },
    ]);
    expect(f.folders).toEqual([{ id: 'c', name: 'sub' }]);
  });
});

describe('ports implemented by WorkDrive', () => {
  it('ObjectStoragePort put/head/delete and refuses when not connected', async () => {
    const m = mock([
      [
        /ensure-path$/,
        (c) => json({ folderId: `fold:${JSON.parse(String(c.init!.body)).segments.join('/')}` }),
      ],
      [
        /upload-request$/,
        () => json({ upload_url: 'https://o/put', upload_id: 'u', file_id: 'f' }, 201),
      ],
      [/PUT https:\/\/o\/put/, () => new Response(null, { status: 204 })],
      [/upload-complete$/, () => json({ file_id: 'f' }, 201)],
      [/\/files\/f\/details$/, () => json({ id: 'f', name: 'x', mimeType: 'image/png', size: 3 })],
      [/DELETE .*\/files\/f$/, () => json({ trashed: true })],
    ]);
    const client = new WorkDriveClient(BASE, KEY, m.fn);
    const store = workDriveObjectStorage(async (t) => (t === 'tenant-a' ? { client } : null));
    const put = await store.putObject({
      tenantId: 'tenant-a',
      key: 'OMA/acme/posts/x.png',
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    });
    expect(put).toEqual({ externalRef: 'f', checksum: sha256Hex(new Uint8Array([1, 2, 3])) });
    expect(JSON.parse(String(m.calls[0]!.init!.body)).segments).toEqual(['OMA', 'acme', 'posts']);
    expect(await store.headObject({ tenantId: 'tenant-a', externalRef: 'f' })).toEqual({
      contentType: 'image/png',
      size: 3,
    });
    await store.deleteObject({ tenantId: 'tenant-a', externalRef: 'f' });
    await expect(store.headObject({ tenantId: 'tenant-b', externalRef: 'f' })).rejects.toThrow(
      /not connected/,
    );
  });

  it('WorkDrivePort.reconcile reports present / missing (never deletes)', async () => {
    const m = mock([
      [/\/files\/ok\/details$/, () => json({ id: 'ok' })],
      [/\/files\/gone\/details$/, () => json({ message: 'File not found' }, 404)],
      [/ensure-path$/, () => json({ folderId: 'fid' })],
    ]);
    const client = new WorkDriveClient(BASE, KEY, m.fn);
    const port = workDrivePort(
      async () => ({ client }),
      async (_t, ref) => (ref === 'asset-1' ? 'ok' : null),
    );
    expect(await port.reconcile({ tenantId: 't', externalRef: 'ok' })).toEqual({
      status: 'present',
    });
    expect(await port.reconcile({ tenantId: 't', externalRef: 'gone' })).toEqual({
      status: 'missing',
    });
    expect(await port.mapFolder({ tenantId: 't', contextPath: 'OMA/acme' })).toEqual({
      folderRef: 'fid',
    });
    expect(await port.syncApproved({ tenantId: 't', fileObjectRefId: 'asset-1' })).toEqual({
      externalRef: 'ok',
    });
    await expect(port.syncApproved({ tenantId: 't', fileObjectRefId: 'x' })).rejects.toThrow(
      /not stored/,
    );
    expect(m.calls.some((c) => c.init?.method === 'DELETE')).toBe(false);
  });
});

describe('layout, limits and key encryption', () => {
  it('builds OMA/{brand}/{kind}, dropping OMA when the key is already rooted at OMA', () => {
    expect(mediaFolderSegments({ brandSlug: 'acme', kind: 'posts', rootFolderName: null })).toEqual(
      ['OMA', 'acme', 'posts'],
    );
    expect(
      mediaFolderSegments({ brandSlug: 'acme', kind: 'logos', rootFolderName: 'OMA' }),
    ).toEqual(['acme', 'logos']);
    expect(
      mediaFolderSegments({ brandSlug: 'acme', kind: 'deliverables', rootFolderName: 'Marketing' }),
    ).toEqual(['OMA', 'acme', 'deliverables']);
    expect(brandFolderSlug('Lumen Coffee & Co.', 'x')).toBe('lumen-coffee-co');
    expect(brandFolderSlug('قهوة لومن', 'x')).toBe('قهوة-لومن');
    expect(brandFolderSlug('***', 'fallback')).toBe('fallback');
    expect(safeFileName('a/b:c*?.png')).toBe('a-b-c-.png');
    expect(safeFileName(`${'n'.repeat(300)}.mp4`)).toHaveLength(191);
  });
  it('500 MB video default, configurable', () => {
    expect(workDriveLimits({}).maxVideoBytes).toBe(500 * 1024 * 1024);
    expect(workDriveLimits({ WORKDRIVE_MAX_VIDEO_MB: '50' }).maxVideoBytes).toBe(50 * 1024 * 1024);
  });
  it('stores the key AES-256-GCM encrypted, with a dedicated or shared env key', () => {
    expect(workDriveSecretKey({})).toBeNull();
    const shared = workDriveSecretKey({ SOCIAL_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64) })!;
    const own = workDriveSecretKey({
      WORKDRIVE_ENCRYPTION_KEY: 'b'.repeat(64),
      SOCIAL_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
    })!;
    expect(own.equals(shared)).toBe(false);
    const enc = encryptToken(KEY, own);
    expect(enc).not.toContain(KEY.slice(4, 20));
    expect(decryptToken(enc, own)).toBe(KEY);
    expect(() => decryptToken(enc, shared)).toThrow();
  });
  it('decodes data-URL logos for migration (images only)', () => {
    expect(decodeImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toMatchObject({
      mime: 'image/png',
    });
    expect(decodeImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(decodeImageDataUrl('https://x/logo.png')).toBeNull();
  });
});
