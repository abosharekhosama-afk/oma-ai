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
};

export async function startFakeWorkDrive(opts: {
  key: string;
  scopes?: string[];
  rootName?: string | null;
  orgName?: string;
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
  const calls: Array<{ method: string; path: string; auth: string | undefined; partSha?: string }> =
    [];
  let maxBodyBytes = 0;

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
      res.writeHead(200, { 'content-type': f.mimeType, 'content-length': String(f.size) });
      res.end(f.bytes ?? Buffer.alloc(f.size));
      return;
    }
    if (req.headers.authorization !== `Bearer ${opts.key}`)
      return send(401, { message: 'Invalid integration key' });
    const json = async () => JSON.parse((await read(req)).toString() || '{}');
    const inRoot = (folderId: string | null): boolean => {
      if (opts.rootName === null) return true;
      let cur = folderId ? folders.get(folderId) : undefined;
      while (cur) {
        if (cur.id === rootId) return true;
        cur = cur.parentId ? folders.get(cur.parentId) : undefined;
      }
      return false;
    };
    let m: RegExpExecArray | null;
    if (path === '/integration/self')
      return send(200, {
        keyId: 'k1',
        prefix: opts.key.slice(0, 16),
        organization: { id: 'org-1', name: opts.orgName ?? 'Imkan Studio' },
        scopes: opts.scopes ?? ['files:read', 'files:write', 'folders:read', 'folders:write'],
        rootFolder: opts.rootName === null ? null : { id: rootId, name: opts.rootName ?? 'OMA' },
      });
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
      return send(200, {
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        folders: [...folders.values()].filter((x) => x.parentId === f.id),
        files: [...files.values()]
          .filter((x) => x.folderId === f.id && !x.trashed)
          .map((x) => ({
            id: x.id,
            name: x.name,
            mimeType: x.mimeType,
            size: String(x.size),
            status: 'ACTIVE',
            deletedAt: null,
            updatedAt: new Date().toISOString(),
          })),
      });
    }
    if (path === '/files/upload-request' && method === 'POST') {
      const b = await json();
      if (!/^[a-f0-9]{64}$/.test(b.sha256)) return send(400, { message: 'Invalid sha256' });
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
        sha256: b.sha256,
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
      if (createHash('sha256').update(up.bytes).digest('hex') !== up.sha256)
        return send(400, { message: 'sha256 mismatch' });
      files.set(up.fileId, {
        id: up.fileId,
        folderId: up.folderId,
        name: up.name,
        mimeType: up.mime,
        size: up.size,
        sha256: up.sha256,
        bytes: up.bytes,
      });
      return send(201, { file_id: up.fileId, upload_id: b.upload_id, status: 'complete' });
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
          download_url: `${base}/storage/objects?token=${f.id}`,
          expires_in_seconds: 900,
          file_id: f.id,
        });
      const bytes = f.bytes ?? Buffer.alloc(f.size);
      const r = /bytes=(\d+)-(\d*)/.exec(String(req.headers.range ?? ''));
      if (r) {
        const start = Number(r[1]);
        const end = r[2] ? Number(r[2]) : bytes.length - 1;
        res.writeHead(206, {
          'content-type': f.mimeType,
          'content-range': `bytes ${start}-${end}/${bytes.length}`,
          'content-length': String(end - start + 1),
          'accept-ranges': 'bytes',
        });
        res.end(bytes.subarray(start, end + 1));
      } else {
        res.writeHead(200, { 'content-type': f.mimeType, 'content-length': String(bytes.length) });
        res.end(bytes);
      }
      return;
    }
    if ((m = /^\/files\/([^/]+)$/.exec(path)) && method === 'DELETE') {
      const f = files.get(m[1]!);
      if (!f) return send(404, { message: 'File not found' });
      f.trashed = true;
      return send(200, { id: f.id, trashed: true });
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
  };
}

export function fakeKey(seed = 'a') {
  return `wdk_${'0123456789ab'}_${seed.repeat(43).slice(0, 43)}`;
}
