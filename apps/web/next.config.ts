import type { NextConfig } from 'next';
import path from 'node:path';

const api = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@oma/i18n', '@oma/ui'],
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
