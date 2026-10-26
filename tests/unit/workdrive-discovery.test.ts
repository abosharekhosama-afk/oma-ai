import { describe, expect, it } from 'vitest';
import { discoverWorkDrive, workDriveUrlCandidates, type FetchLike } from '@oma/domain';

const KEY = `wdk_0123456789ab_${'K'.repeat(43)}`;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
const html = (status = 404) =>
  new Response('<!DOCTYPE html><html></html>', {
    status,
    headers: { 'content-type': 'text/html' },
  });
const SELF = {
  keyId: 'k',
  prefix: 'wdk_0123456789ab',
  organization: { id: 'o', name: 'Imkan Studio' },
  scopes: [],
  rootFolder: null,
};
const nest404 = (p: string) =>
  json({ message: `Cannot GET ${p}`, error: 'Not Found', statusCode: 404 }, 404);

function server(routes: Record<string, () => Response>): { fn: FetchLike; urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    fn: async (u) => {
      urls.push(String(u));
      const r = routes[String(u)];
      return r ? r() : nest404(new URL(String(u)).pathname);
    },
  };
}

describe('WorkDrive address discovery', () => {
  it('builds candidates with and without /api, /api/v1 and trailing slashes', () => {
    expect(workDriveUrlCandidates('https://wd.example.com/')).toEqual([
      'https://wd.example.com',
      'https://wd.example.com/api',
      'https://wd.example.com/api/v1',
    ]);
    expect(workDriveUrlCandidates('https://wd.example.com/api/v1/')).toEqual([
      'https://wd.example.com/api/v1',
      'https://wd.example.com',
      'https://wd.example.com/api',
    ]);
  });

  it('finds the API at the root when the person typed /api', async () => {
    const s = server({ 'https://wd.example.com/integration/self': () => json(SELF) });
    const r = await discoverWorkDrive('https://wd.example.com/api/', KEY, s.fn);
    expect(r.baseUrl).toBe('https://wd.example.com');
    expect(r.self.organization.name).toBe('Imkan Studio');
  });

  it('finds the API under /api when it is served there', async () => {
    const s = server({ 'https://wd.example.com/api/integration/self': () => json(SELF) });
    expect((await discoverWorkDrive('https://wd.example.com', KEY, s.fn)).baseUrl).toBe(
      'https://wd.example.com/api',
    );
  });

  it('key invalid or revoked → unauthorized (stops at the first WorkDrive answer)', async () => {
    const s = server({
      'https://wd.example.com/integration/self': () =>
        json({ message: 'Invalid integration key', error: 'Unauthorized', statusCode: 401 }, 401),
    });
    await expect(discoverWorkDrive('https://wd.example.com', KEY, s.fn)).rejects.toMatchObject({
      code: 'unauthorized',
    });
    expect(s.urls).toHaveLength(1);
  });

  it('key lacks permission → forbidden', async () => {
    const s = server({
      'https://wd.example.com/integration/self': () =>
        json({ message: 'Forbidden', statusCode: 403 }, 403),
    });
    await expect(discoverWorkDrive('https://wd.example.com', KEY, s.fn)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('WorkDrive without integration keys (route not found everywhere) → outdated', async () => {
    const s = server({});
    await expect(discoverWorkDrive('https://wd.example.com', KEY, s.fn)).rejects.toMatchObject({
      code: 'outdated',
    });
    expect(s.urls).toHaveLength(3);
  });

  it('a website (HTML / redirect to login) → not_workdrive, never "file removed"', async () => {
    const fn: FetchLike = async () => html();
    await expect(
      discoverWorkDrive('https://imkan-work-drive-v1.vercel.app', KEY, fn),
    ).rejects.toMatchObject({ code: 'not_workdrive' });
    const redirect: FetchLike = async () =>
      new Response(null, { status: 307, headers: { location: '/auth/login' } });
    await expect(discoverWorkDrive('https://wd.example.com', KEY, redirect)).rejects.toMatchObject({
      code: 'not_workdrive',
    });
  });

  it('nothing answers → unavailable after one attempt', async () => {
    let n = 0;
    const fn: FetchLike = async () => {
      n++;
      throw new Error('ECONNREFUSED');
    };
    await expect(discoverWorkDrive('https://wd.example.com', KEY, fn)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(n).toBe(1);
  });
});
