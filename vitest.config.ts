import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'tests/security/**/*.test.ts',
    ],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@oma/domain': path.resolve(__dirname, 'packages/domain/src/index.ts'),
      '@oma/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
      '@oma/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@oma/observability': path.resolve(__dirname, 'packages/observability/src/index.ts'),
      '@oma/i18n': path.resolve(__dirname, 'packages/i18n/src/index.ts'),
    },
  },
});
