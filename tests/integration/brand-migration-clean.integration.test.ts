import { execFileSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

describe('brand migration clean deploy', () => {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    it.skip('DATABASE_URL required', () => undefined);
    return;
  }

  const schema = `brand_${newId()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10)}`;
  const migratedUrl = withSchema(baseUrl, schema);
  const admin = getPrisma();

  afterAll(async () => {
    try {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } catch {
      /* ignore */
    }
  });

  it('deploys brand_website_intelligence migration on empty schema', async () => {
    await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    execFileSync('pnpm', ['--filter', '@oma/db', 'exec', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: migratedUrl },
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    const indexes = await admin.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = ${schema}
        AND tablename = 'BrandWorkspace'
        AND indexname = 'BrandWorkspace_tenantId_status_updatedAt_idx'
    `;
    expect(indexes.length).toBe(1);
  });
});
