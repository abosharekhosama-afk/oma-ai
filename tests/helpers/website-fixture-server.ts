import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function resolveFixtureRoot(): string {
  const candidates = [
    join(process.cwd(), 'tests/fixtures/websites'),
    join(process.cwd(), '../../tests/fixtures/websites'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0];
}

const FIXTURE_ROOT = resolveFixtureRoot();

export function startWebsiteFixtureServer(port = 0): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((req, res) => {
    const host = req.headers.host ?? '127.0.0.1';
    const url = new URL(req.url ?? '/', `http://${host}`);
    let rel = url.pathname.replace(/^\//, '') || 'index.html';
    if (!rel.endsWith('.html')) {
      rel = rel.endsWith('/') ? `${rel}index.html` : `${rel}.html`;
    }
    const file = join(FIXTURE_ROOT, 'acme', rel);
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<html><body>Not found</body></html>');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(readFileSync(file));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') return reject(new Error('no address'));
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}
