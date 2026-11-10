import http from 'node:http';
import type { AddressInfo } from 'node:net';
import iconv from 'iconv-lite';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveWebsiteFetchError, createLiveWebsiteConnector } from './live-website-connector';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

async function listen(
  handler: Handler,
): Promise<{ url: string; port: number; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function testConnector() {
  return createLiveWebsiteConnector({
    allowPrivateHosts: true,
    delayMs: 0,
    timeoutMs: 1500,
    connectTimeoutMs: 500,
    maxRetries: 1,
    maxRedirects: 5,
    maxBytes: 2048,
  });
}

const servers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    const close = servers.pop();
    if (close) await close();
  }
});

describe('live-website-connector', () => {
  it('fetches html, follows same-host redirects and decodes charset', async () => {
    const arabic =
      '<html><head><meta charset="windows-1256"><title>مرحبا</title></head><body>مرحبا</body></html>';
    const server = await listen((req, res) => {
      if (req.url === '/go') {
        res.writeHead(302, { location: '/ar' });
        res.end();
        return;
      }
      if (req.url === '/ar') {
        res.writeHead(200, { 'content-type': 'text/html; charset=windows-1256' });
        res.end(iconv.encode(arabic, 'windows-1256'));
        return;
      }
      res.writeHead(404);
      res.end('missing');
    });
    servers.push(server.close);
    const connector = testConnector();
    const fetched = await connector.fetchPublic({ url: `${server.url}/go` });
    expect(fetched.status).toBe(200);
    expect(fetched.body).toContain('مرحبا');
    expect(fetched.redirectChain[0]).toBe(`${server.url}/go`);
    expect(fetched.finalUrl).toBe(`${server.url}/ar`);
  });

  it('records cross-origin redirects without following them', async () => {
    const server = await listen((_req, res) => {
      res.writeHead(302, { location: 'https://other.test/elsewhere' });
      res.end();
    });
    servers.push(server.close);
    const fetched = await testConnector().fetchPublic({ url: `${server.url}/out` });
    expect(fetched.status).toBe(302);
    expect(fetched.body).toBe('');
    expect(fetched.redirectChain).toContain('https://other.test/elsewhere');
    expect(fetched.finalUrl).toBe(`${server.url}/out`);
  });

  it('enforces a streaming byte limit', async () => {
    const server = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html><body>${'x'.repeat(8000)}</body></html>`);
    });
    servers.push(server.close);
    await expect(
      testConnector().fetchPublic({ url: `${server.url}/big`, maxBytes: 100 }),
    ).rejects.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('times out a stalled response', async () => {
    const server = await listen(() => {
      // never respond
    });
    servers.push(server.close);
    const connector = createLiveWebsiteConnector({
      allowPrivateHosts: true,
      delayMs: 0,
      timeoutMs: 150,
      connectTimeoutMs: 150,
      maxRetries: 0,
    });
    await expect(connector.fetchPublic({ url: `${server.url}/slow` })).rejects.toBeInstanceOf(
      LiveWebsiteFetchError,
    );
  });

  it('parses robots.txt, sitemaps and applies 404 vs 5xx policy', async () => {
    const server = await listen((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('User-agent: *\nDisallow: /secret\nSitemap: /sitemap.xml\n');
        return;
      }
      res.writeHead(404);
      res.end('no');
    });
    servers.push(server.close);
    const connector = testConnector();
    const host = `127.0.0.1:${server.port}`;
    expect(await connector.evaluateRobots(host, '/secret')).toBe('DISALLOW');
    expect(await connector.evaluateRobots(host, '/about')).toBe('ALLOW');
    const info = await connector.inspectRobots(host);
    expect(info.sitemaps.some((item) => item.includes('sitemap.xml'))).toBe(true);
  });

  it('treats a missing robots file as allow and a 5xx file as disallow', async () => {
    const missing = await listen((req, res) => {
      res.writeHead(req.url === '/robots.txt' ? 404 : 200, { 'content-type': 'text/plain' });
      res.end('nope');
    });
    servers.push(missing.close);
    expect(await testConnector().evaluateRobots(`127.0.0.1:${missing.port}`, '/')).toBe('ALLOW');

    const unavailable = await listen((req, res) => {
      res.writeHead(req.url === '/robots.txt' ? 503 : 200, { 'content-type': 'text/plain' });
      res.end('down');
    });
    servers.push(unavailable.close);
    expect(await testConnector().evaluateRobots(`127.0.0.1:${unavailable.port}`, '/')).toBe(
      'DISALLOW',
    );
  });

  it('validates reachable html and rejects non-html plus robots disallow-all', async () => {
    const server = await listen((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('User-agent: *\nDisallow: /blocked\n');
        return;
      }
      if (req.url === '/page') {
        if (req.method === 'HEAD') {
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><title>Ok</title></html>');
        return;
      }
      if (req.url === '/file.json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }
      res.writeHead(404);
      res.end('missing');
    });
    servers.push(server.close);
    const connector = testConnector();
    await expect(connector.validateSource({ url: `${server.url}/page` })).resolves.toEqual({
      ok: true,
    });
    await expect(
      connector.validateSource({ url: `${server.url}/file.json` }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'WEBSITE_NON_HTML',
    });
    await expect(connector.validateSource({ url: `${server.url}/blocked` })).resolves.toMatchObject(
      {
        ok: false,
        code: 'WEBSITE_ROBOTS_DISALLOWED',
      },
    );
  });

  it('blocks metadata and private targets even with the loopback test override', async () => {
    const connector = testConnector();
    await expect(connector.fetchPublic({ url: 'http://169.254.169.254/' })).rejects.toMatchObject({
      code: 'URL_SSRF_DENIED',
    });
    await expect(connector.fetchPublic({ url: 'http://10.0.0.8/' })).rejects.toMatchObject({
      code: 'URL_SSRF_DENIED',
    });
    const locked = createLiveWebsiteConnector({
      allowPrivateHosts: false,
      delayMs: 0,
      timeoutMs: 500,
    });
    await expect(locked.fetchPublic({ url: 'http://127.0.0.1/' })).rejects.toMatchObject({
      code: 'URL_SSRF_DENIED',
    });
  });

  it('fails closed if production tries to honor allowPrivateHosts', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const connector = createLiveWebsiteConnector({
        allowPrivateHosts: true,
        delayMs: 0,
        timeoutMs: 300,
      });
      await expect(connector.fetchPublic({ url: 'http://127.0.0.1/' })).rejects.toMatchObject({
        code: 'URL_SSRF_DENIED',
      });
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
