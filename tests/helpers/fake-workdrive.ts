import { createHash, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** In-memory stand-in for the WorkDrive integration API (same routes and shapes). */
export type FakeFile = {
  id: string;
  folderId: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  bytes?: Buffer;
  trashed?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function startFakeWorkDrive(opts: {
  key: string;
  scopes?: string[];
  rootName?: string | null;
  orgName?: string;
  /** Behave like WorkDrive on remote object storage: `/files/:id/stream` → 302 signed URL. */
  streamRedirect?: boolean;
}) {
  const rootId = randomUUID();
  const folders = new Map<string, { id: string; name: string; parentId: string | null }>();
  if (opts.rootName !== null)
    folders.set(rootId, { id: rootId, name: opts.rootName ?? 'OMA', parentId: null });
  const files = new Map<string, FakeFile>();
  const uploads = new Map<
    string,
    {
      fileId: string;
      folderId: string;
      name: string;
      mime: string;
      size: number;
      sha256: string;
      bytes?: Buffer;
    }
  >();
  const sessions = new Map<
    string,
    {
      fileId: string;
      folderId: string;
      name: string;
      mime: string;
      size: number;
      sha256: string;
      parts: Map<number, string>;
      total: number;
    }
  >();
  const calls: Array<{
    method: string;
    path: string;
    auth: string | undefined;
    partSha?: string;
    range?: string;
  }> = [];
  let maxBodyBytes = 0;
  let rejectUploads: { status: number; message: string } | null = null;
  let rejectDeletes: { status: number; message: string } | null = null;
  let quotaBytes: number | null = 10 * 1024 * 1024 * 1024;
  const childKeys = new Map<
    string,
    {
      id: string;
      key: string;
      name: string;
      rootFolderId: string;
      scopes: string[];
      revokedAt: string | null;
    }
  >();
  const webhooks: Array<{ id: string; url: string; secret: string; events: string[] }> = [];

  const read = (req: IncomingMessage) =>
    new Promise<Buffer>((res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => res(Buffer.concat(chunks)));
    });

  let base = '';
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    calls.push({
      method,
      path,
      auth: req.headers.authorization,
      partSha: req.headers['x-part-sha256'] as string | undefined,
      range: req.headers.range as string | undefined,
    });
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    // Signed object URLs (no Authorization).
    if (path === '/storage/objects') {
      const tok = url.searchParams.get('token') ?? '';
      if (method === 'PUT') {
        const up = uploads.get(tok);
        if (!up) return send(401, { message: 'Invalid storage token' });
        const body = await read(req);
        maxBodyBytes = Math.max(maxBodyBytes, body.length);
        if (body.length !== up.size) return send(400, { message: 'size mismatch' });
        up.bytes = body;
        res.writeHead(204).end();
        return;
      }
      const f = files.get(tok);
      if (!f || f.trashed) return send(404, { message: 'not found' });
      // Like real WorkDrive signed URLs: stored MIME + HTTP Range (video seeking / Safari).
      return sendBytes(res, f.mimeType, f.bytes ?? Buffer.alloc(f.size), req.headers.range);
    }
    const bearer = req.headers.authorization ?? '';
    const child = [...childKeys.values()].find((c) => bearer === `Bearer ${c.key}` && !c.revokedAt);
    if (bearer !== `Bearer ${opts.key}` && !child)
      return send(401, { message: 'Invalid integration key' });
    const authScopes = child?.scopes ??
      opts.scopes ?? ['files:read', 'files:write', 'folders:read', 'folders:write'];
    const authRoot = child?.rootFolderId ?? rootId;
    const json = async () => JSON.parse((await read(req)).toString() || '{}');
    const inRoot = (folderId: string | null): boolean => {
      if (opts.rootName === null && !child) return true;
      let cur = folderId ? folders.get(folderId) : undefined;
      while (cur) {
        if (cur.id === authRoot) return true;
        cur = cur.parentId ? folders.get(cur.parentId) : undefined;
      }
      return false;
    };
    const hasManage = authScopes.includes('keys:manage');
    let m: RegExpExecArray | null;
    if (path === '/integration/self')
      return send(200, {
        keyId: child?.id ?? 'k1',
        prefix: (child?.key ?? opts.key).slice(0, 16),
        organization: { id: 'org-1', name: opts.orgName ?? 'Imkan Studio' },
        scopes: authScopes,
        rootFolder: child
          ? { id: child.rootFolderId, name: folders.get(child.rootFolderId)?.name ?? 'tenant' }
          : opts.rootName === null
            ? null
            : { id: rootId, name: opts.rootName ?? 'OMA' },
      });
    if (path === '/integration/keys' && method === 'GET') {
      if (!hasManage) return send(403, { message: 'keys:manage required' });
      return send(
        200,
        [...childKeys.values()].map((c) => ({
          id: c.id,
          name: c.name,
          prefix: c.key.slice(0, 16),
          scopes: c.scopes,
          rootFolder: { id: c.rootFolderId, name: folders.get(c.rootFolderId)?.name ?? '' },
          revokedAt: c.revokedAt,
        })),
      );
    }
    if (path === '/integration/keys' && method === 'POST') {
      if (!hasManage) return send(403, { message: 'keys:manage required' });
      const b = await json();
      if ((b.scopes ?? []).includes('keys:manage'))
        return send(403, { message: 'Child keys cannot receive the keys:manage scope' });
      const rootFolderId = b.rootFolderId ?? b.root_folder_id;
      if (!rootFolderId || !folders.has(rootFolderId) || !inRoot(rootFolderId))
        return send(403, { message: 'rootFolderId must be inside the parent key root folder' });
      const id = randomUUID();
      const key = `wdk_${'0123456789ab'}_${id.replace(/-/g, '').slice(0, 43).padEnd(43, 'x')}`;
      childKeys.set(id, {
        id,
        key,
        name: String(b.name ?? 'child'),
        rootFolderId,
        scopes: b.scopes ?? ['files:read', 'files:write', 'folders:read', 'folders:write'],
        revokedAt: null,
      });
      return send(201, {
        key: {
          id,
          name: childKeys.get(id)!.name,
          prefix: key.slice(0, 16),
          scopes: childKeys.get(id)!.scopes,
          rootFolder: { id: rootFolderId, name: folders.get(rootFolderId)?.name ?? '' },
        },
        secret: key,
      });
    }
    if ((m = /^\/integration\/keys\/([^/]+)\/revoke$/.exec(path)) && method === 'POST') {
      if (!hasManage) return send(403, { message: 'keys:manage required' });
      const row = childKeys.get(m[1]!);
      if (!row) return send(404, { message: 'key not found' });
      row.revokedAt = new Date().toISOString();
      return send(200, { id: row.id, revokedAt: row.revokedAt });
    }
    if (path === '/integration/webhooks' && method === 'POST') {
      if (!hasManage) return send(403, { message: 'keys:manage required' });
      const b = await json();
      const hook = {
        id: randomUUID(),
        url: String(b.url),
        secret: String(b.secret || `whsec_${randomUUID()}`),
        events: Array.isArray(b.events) ? b.events : [],
      };
      webhooks.push(hook);
      return send(201, {
        webhook: { id: hook.id, url: hook.url, events: hook.events },
        secret: hook.secret,
      });
    }
    if (path === '/integration/webhooks' && method === 'GET') {
      if (!hasManage) return send(403, { message: 'keys:manage required' });
      return send(
        200,
        webhooks.map((w) => ({ id: w.id, url: w.url, events: w.events })),
      );
    }
    if (path === '/folders/ensure-path' && method === 'POST') {
      const b = await json();
      const segs: string[] = b.segments ?? String(b.path).split('/');
      let parent: string | null = b.parentId ?? (opts.rootName === null ? null : rootId);
      const out: Array<{ id: string; name: string }> = [];
      for (const name of segs) {
        let f = [...folders.values()].find((x) => x.parentId === parent && x.name === name);
        if (!f) {
          f = { id: randomUUID(), name, parentId: parent };
          folders.set(f.id, f);
        }
        out.push({ id: f.id, name: f.name });
        parent = f.id;
      }
      return send(200, { folderId: parent, name: segs.at(-1), path: out, created: true });
    }
    if ((m = /^\/folders\/([^/]+)$/.exec(path)) && method === 'GET') {
      const f = folders.get(m[1]!);
      if (!f || !inRoot(f.id)) return send(404, { message: 'Folder not found' });
      const folderItems = [...folders.values()].filter((x) => x.parentId === f.id);
      const fileItems = [...files.values()].filter((x) => x.folderId === f.id && !x.trashed);
      const combined = [
        ...folderItems.map((item) => ({ kind: 'folder' as const, id: item.id, item })),
        ...fileItems.map((item) => ({ kind: 'file' as const, id: item.id, item })),
      ];
      const rawLimit = url.searchParams.get('limit');
      const rawOffset = url.searchParams.get('offset');
      const cursor = url.searchParams.get('cursor');
      const paging = rawLimit != null || rawOffset != null || cursor != null;
      let start = rawOffset ? Math.max(0, Number(rawOffset) || 0) : 0;
      if (cursor) {
        const idx = combined.findIndex((c) => `${c.kind}:${c.id}` === cursor);
        start = idx >= 0 ? idx + 1 : 0;
      }
      const limit =
        rawLimit != null
          ? Math.min(500, Math.max(1, Number(rawLimit) || 100))
          : paging
            ? 100
            : combined.length;
      const page = paging ? combined.slice(start, start + limit) : combined;
      const next =
        paging && start + page.length < combined.length && page.length
          ? `${page[page.length - 1]!.kind}:${page[page.length - 1]!.id}`
          : null;
      return send(200, {
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        folders: page.filter((x) => x.kind === 'folder').map((x) => x.item),
        files: page
          .filter((x) => x.kind === 'file')
          .map((x) => x.item as (typeof fileItems)[number])
          .map((x) => ({
            id: x.id,
            name: x.name,
            mimeType: x.mimeType,
            size: String(x.size),
            status: 'ACTIVE',
            deletedAt: null,
            updatedAt: (x.updatedAt ?? x.createdAt ?? new Date()).toISOString(),
            createdAt: (x.createdAt ?? x.updatedAt ?? new Date()).toISOString(),
          })),
        next_cursor: next,
        has_more: Boolean(next),
      });
    }
    if (path === '/files/upload-request' && method === 'POST' && rejectUploads) {
      return send(rejectUploads.status, { message: rejectUploads.message });
    }
    if (path === '/files/upload-request' && method === 'POST') {
      const b = await json();
      if (b.sha256 != null && b.sha256 !== '' && !/^[a-f0-9]{64}$/.test(b.sha256))
        return send(400, { message: 'Invalid sha256' });
      if (!inRoot(b.folder_id)) return send(403, { message: 'outside root' });
      if (
        [...files.values()].some(
          (f) => f.folderId === b.folder_id && f.name === b.name && !f.trashed,
        )
      )
        return send(409, {
          message: 'A file with this name already exists in the destination folder',
        });
      const token = randomUUID();
      const fileId = randomUUID();
      uploads.set(token, {
        fileId,
        folderId: b.folder_id,
        name: b.name,
        mime: b.mime_type,
        size: b.size,
        sha256:
          typeof b.sha256 === 'string' && /^[a-f0-9]{64}$/.test(b.sha256)
            ? b.sha256
            : '0'.repeat(64),
      });
      return send(201, {
        upload_url: `${base}/storage/objects?token=${token}`,
        upload_id: token,
        file_id: fileId,
      });
    }
    if (path === '/files/upload-complete' && method === 'POST') {
      const b = await json();
      const up = uploads.get(b.upload_id);
      if (!up?.bytes) return send(400, { message: 'not uploaded' });
      const actual = createHash('sha256').update(up.bytes).digest('hex');
      if (up.sha256 !== '0'.repeat(64) && actual !== up.sha256)
        return send(400, { message: 'sha256 mismatch' });
      files.set(up.fileId, {
        id: up.fileId,
        folderId: up.folderId,
        name: up.name,
        mimeType: up.mime,
        size: up.size,
        sha256: actual,
        bytes: up.bytes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return send(201, {
        file_id: up.fileId,
        upload_id: b.upload_id,
        status: 'complete',
        sha256: actual,
      });
    }
    if (path === '/files/upload-sessions' && method === 'POST') {
      const b = await json();
      const sid = randomUUID();
      const part = b.partSize ?? 16 * 1048576;
      sessions.set(sid, {
        fileId: randomUUID(),
        folderId: b.folderId,
        name: b.name,
        mime: b.mimeType,
        size: b.size,
        sha256: b.sha256,
        parts: new Map(),
        total: Math.ceil(b.size / part),
      });
      return send(201, {
        session_id: sid,
        file_id: sessions.get(sid)!.fileId,
        part_size: part,
        total_parts: sessions.get(sid)!.total,
      });
    }
    if ((m = /^\/files\/upload-sessions\/([^/]+)\/parts\/(\d+)$/.exec(path))) {
      const s = sessions.get(m[1]!);
      if (!s) return send(404, { message: 'no session' });
      const body = await read(req);
      maxBodyBytes = Math.max(maxBodyBytes, body.length);
      s.parts.set(Number(m[2]), String(req.headers['x-part-sha256']));
      return send(201, { part: Number(m[2]) });
    }
    if ((m = /^\/files\/upload-sessions\/([^/]+)\/complete$/.exec(path))) {
      const s = sessions.get(m[1]!);
      if (!s || s.parts.size !== s.total) return send(400, { message: 'parts missing' });
      files.set(s.fileId, {
        id: s.fileId,
        folderId: s.folderId,
        name: s.name,
        mimeType: s.mime,
        size: s.size,
        sha256: s.sha256,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return send(201, { file_id: s.fileId, status: 'complete' });
    }
    if ((m = /^\/files\/upload-sessions\/([^/]+)$/.exec(path)) && method === 'DELETE') {
      sessions.delete(m[1]!);
      return send(200, { aborted: true });
    }
    if ((m = /^\/files\/([^/]+)\/(details|preview-url|download|stream)$/.exec(path))) {
      const f = files.get(m[1]!);
      if (!f || f.trashed || !inRoot(f.folderId)) return send(404, { message: 'File not found' });
      if (m[2] === 'details')
        return send(200, {
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          location: { id: f.folderId },
        });
      if (m[2] === 'preview-url')
        return send(200, {
          preview_url: `${base}/storage/objects?token=${f.id}`,
          expires_in_seconds: 900,
          file_id: f.id,
          mime_type: f.mimeType,
        });
      if (m[2] === 'download')
        return send(200, {
          download_url: `${base}/storage/objects?token=${f.id}&original=1`,
          expires_in_seconds: 900,
          file_id: f.id,
        });
      // WorkDrive with remote object storage answers `/stream` with a 302 to a signed URL.
      if (opts.streamRedirect) {
        res.writeHead(302, { location: `${base}/storage/objects?token=${f.id}` });
        res.end();
        return;
      }
      return sendBytes(res, f.mimeType, f.bytes ?? Buffer.alloc(f.size), req.headers.range);
    }
    if ((m = /^\/files\/([^/]+)$/.exec(path)) && method === 'DELETE') {
      if (rejectDeletes) return send(rejectDeletes.status, { message: rejectDeletes.message });
      const f = files.get(m[1]!);
      if (!f) return send(404, { message: 'File not found' });
      f.trashed = true;
      return send(200, { id: f.id, trashed: true });
    }
    if (path === '/storage/quota' && method === 'GET') {
      const used = [...files.values()].filter((f) => !f.trashed).reduce((n, f) => n + f.size, 0);
      return send(200, { usedBytes: used, quotaBytes, used_bytes: used, quota_bytes: quotaBytes });
    }
    send(404, { message: 'route' });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    baseUrl: base,
    rootId,
    folders,
    files,
    calls,
    maxBodyBytes: () => maxBodyBytes,
    pathOf(folderId: string) {
      const out: string[] = [];
      let cur = folders.get(folderId);
      while (cur && cur.id !== rootId) {
        out.unshift(cur.name);
        cur = cur.parentId ? folders.get(cur.parentId) : undefined;
      }
      return out.join('/');
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
    setRejectUploads(next: { status: number; message: string } | null) {
      rejectUploads = next;
    },
    setRejectDeletes(next: { status: number; message: string } | null) {
      rejectDeletes = next;
    },
    setQuotaBytes(next: number | null) {
      quotaBytes = next;
    },
  };
}

export function fakeKey(seed = 'a') {
  return `wdk_${'0123456789ab'}_${seed.repeat(43).slice(0, 43)}`;
}

function sendBytes(
  res: import('node:http').ServerResponse,
  mimeType: string,
  bytes: Buffer,
  range: string | undefined,
) {
  const r = /bytes=(\d+)-(\d*)/.exec(String(range ?? ''));
  if (r) {
    const start = Number(r[1]);
    const end = r[2] ? Math.min(Number(r[2]), bytes.length - 1) : bytes.length - 1;
    res.writeHead(206, {
      'content-type': mimeType,
      'content-range': `bytes ${start}-${end}/${bytes.length}`,
      'content-length': String(end - start + 1),
      'accept-ranges': 'bytes',
    });
    res.end(bytes.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, {
    'content-type': mimeType,
    'content-length': String(bytes.length),
    'accept-ranges': 'bytes',
  });
  res.end(bytes);
}
