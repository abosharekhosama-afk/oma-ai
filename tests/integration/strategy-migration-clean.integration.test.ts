import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getPrisma } from '@oma/db';

describe('strategy migration clean database', () => {
  it('strategy migration folder exists and BrandWorkspace pointer column is queryable', async () => {
    const mig = path.join(
      process.cwd(),
      'packages/db/prisma/migrations/20260910180000_strategy_organic_paid_plans/migration.sql',
    );
    expect(existsSync(mig)).toBe(true);
    const prisma = getPrisma();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'BrandWorkspace' AND column_name = 'currentApprovedStrategyId'`,
    );
    expect(Array.isArray(rows) && rows.length > 0).toBe(true);
  });
});
