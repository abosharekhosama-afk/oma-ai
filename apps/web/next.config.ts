import type { NextConfig } from 'next';
import path from 'node:path';

const api = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

// CI builds the production app into .next, then starts `next dev` for Playwright.
// Sharing that directory makes the dev server serve stale chunks.
const ciDevDist = process.env.CI && process.env.NODE_ENV !== 'production' ? '.next-e2e' : undefined;
const distDir = process.env.NEXT_DIST_DIR ?? ciDevDist;

const nextConfig: NextConfig = {
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

export default nextConfig;
