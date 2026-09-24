import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../apps/api/src/app.module';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { ensurePlatformOwner } from './platform-owner';

export async function createTestApp(): Promise<{
  app: INestApplication;
  server: Server;
  baseUrl: string;
}> {
  await ensurePlatformOwner();
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no address');
  return { app, server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

export function parseCookies(res: Response): Record<string, string> {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = typeof anyHeaders.getSetCookie === 'function' ? anyHeaders.getSetCookie() : [];
  const single = res.headers.get('set-cookie');
  const list = raw.length ? raw : single ? [single] : [];
  const out: Record<string, string> = {};
  for (const c of list) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
}
