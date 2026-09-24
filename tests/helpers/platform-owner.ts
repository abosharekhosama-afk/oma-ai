import { execFileSync } from 'node:child_process';
import path from 'node:path';

function parseCookies(res: Response): Record<string, string> {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = typeof anyHeaders.getSetCookie === 'function' ? anyHeaders.getSetCookie() : [];
  const single = res.headers.get('set-cookie');
  const list = raw.length ? raw : single ? [single] : [];
  const out: Record<string, string> = {};
  for (const c of list) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    out[pair.slice(0, eq).trim()] = decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return out;
}

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

let ready: Promise<void> | null = null;

export function platformOwnerCredentials(): { email: string; password: string } {
  const email = process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_PLATFORM_OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Integration tests require BOOTSTRAP_PLATFORM_OWNER_EMAIL and BOOTSTRAP_PLATFORM_OWNER_PASSWORD',
    );
  }
  return { email, password };
}

/**
 * Creates the local platform owner when missing. Does not rotate an existing
 * password and does not change login or capability checks.
 */
export function ensurePlatformOwner(): Promise<void> {
  if (!ready) {
    ready = Promise.resolve().then(() => {
      const url = process.env.DATABASE_URL ?? '';
      let host = '';
      try {
        host = new URL(url).hostname;
      } catch {
        throw new Error('platform owner bootstrap requires a local DATABASE_URL');
      }
      if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
        throw new Error('platform owner bootstrap is refused against a non-local database');
      }
      const result = execFileSync('pnpm', ['--filter', '@oma/api', 'bootstrap:platform-owner'], {
        cwd: REPO_ROOT,
        env: process.env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      void result;
    });
  }
  return ready;
}

export async function loginPlatformOwner(baseUrl: string): Promise<Record<string, string>> {
  await ensurePlatformOwner();
  const owner = platformOwnerCredentials();
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(owner),
  });
  if (login.status !== 200) {
    throw new Error(`platform owner login failed with status ${login.status}`);
  }
  return parseCookies(login);
}
