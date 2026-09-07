import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';

const REPO_ROOT = new URL('../../', import.meta.url).pathname;

function runSeed(env: NodeJS.ProcessEnv = {}) {
  return execFileSync('pnpm', ['db:seed:demo'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * The quickstart tells developers to re-run `pnpm db:seed:demo` freely, and the
 * seed is the only way demo brands reach the real domain tables.
 */
describe('demo seed', () => {
  it('is idempotent and leaves one demo tenant carrying its fixture brands', async () => {
    runSeed();
    const prisma = getPrisma();
    const tenant = await prisma.tenant.findFirstOrThrow({ where: { slug: 'oma-demo' } });
    const firstCount = await prisma.brandWorkspace.count({ where: { tenantId: tenant.id } });
    // The demo tenant is a real tenant a developer can also create brands in,
    // so assert the fixtures exist rather than an exact total.
    const fixtureNames = (
      await prisma.brandWorkspace.findMany({
        where: { tenantId: tenant.id, name: { endsWith: '(Demo)' } },
        select: { name: true },
      })
    ).map((b) => b.name);
    expect(fixtureNames).toEqual(
      expect.arrayContaining([
        'Northwind Services (Demo)',
        'Acme Retail (Demo)',
        'Globex Group (Demo)',
      ]),
    );

    const secondRun = runSeed();
    expect(secondRun).toContain('exists');

    const tenants = await prisma.tenant.count({ where: { slug: 'oma-demo' } });
    expect(tenants).toBe(1);
    expect(await prisma.brandWorkspace.count({ where: { tenantId: tenant.id } })).toBe(firstCount);
  }, 120_000);

  it('refuses to run outside development or test', () => {
    expect(() => runSeed({ OMA_ENV: 'production' })).toThrow();
  }, 60_000);

  it('refuses to run against a non-local database host', () => {
    const url = new URL(process.env.DATABASE_URL ?? 'postgresql://u:p@127.0.0.1:5432/db');
    url.hostname = 'db.production.example.com';
    expect(() => runSeed({ DATABASE_URL: url.toString() })).toThrow();
  }, 60_000);
});
