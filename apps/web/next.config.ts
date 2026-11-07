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
    poweredByHeader: false,
    compress: true,
    images: {
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 86400,
    },
    experimental: {
      optimizePackageImports: ['@ant-design/icons', '@oma/ui', 'dayjs', 'antd'],
    },
    ...(distDir ? { distDir } : {}),

    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: true,
    },

    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: `${api}/api/:path*`,
        },
      ];
    },
    async headers() {
      return [
        {
          source: '/(landing|demo)/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        {
          source: '/:path*',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-DNS-Prefetch-Control', value: 'on' },
            { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            {
              key: 'Content-Security-Policy',
              value:
                "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws: wss:;",
            },
          ],
        },
      ];
    },
  };
};

export default nextConfig;
