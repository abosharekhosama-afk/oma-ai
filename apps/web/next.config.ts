import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import fs from 'node:fs';
import path from 'node:path';

const api = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

/**
 * CI runs `next build` into `.next`, then `next dev` for Playwright.
 * Reusing that production output serves stale chunks (ChunkLoadError).
 * Pointing dev at another distDir rewrites `next-env.d.ts` while the dev
 * server is up, which Fast Refresh treats as a full rebuild and drops
 * in-flight client navigations. Delete only a finished production dist so
 * dev recompiles into the path `next-env.d.ts` already references.
 */
function clearStaleProductionDist(phase: string) {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return;
  if (process.env.CI !== 'true') return;
  if (process.env.NEXT_DIST_DIR) return;
  const dist = path.join(__dirname, '.next');
  const buildIdPath = path.join(dist, 'BUILD_ID');
  if (!fs.existsSync(buildIdPath)) return;
  const buildId = fs.readFileSync(buildIdPath, 'utf8').trim();
  if (!buildId || buildId === 'development') return;
  fs.rmSync(dist, { recursive: true, force: true });
}

const nextConfig = (phase: string): NextConfig => {
  clearStaleProductionDist(phase);
  // `next dev` keeps a pre-set NODE_ENV. CI sets NODE_ENV=test for the job,
  // which is not the development server Next and React expect.
  const env = process.env as Record<string, string | undefined>;
  if (phase === PHASE_DEVELOPMENT_SERVER && env.NODE_ENV === 'test') {
    env.NODE_ENV = 'development';
  }
  const distDir = process.env.NEXT_DIST_DIR;
  return {
    outputFileTracingRoot: path.join(__dirname, '../..'),
    transpilePackages: ['@oma/i18n', '@oma/ui'],
    ...(distDir ? { distDir } : {}),
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: `${api}/api/:path*`,
        },
      ];
    },
  };
};

export default nextConfig;
