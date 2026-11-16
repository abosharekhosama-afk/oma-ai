/**
 * Backfill WorkRequest brief columns into Brief rows (DEC-019 §7).
 *
 *   pnpm --filter @oma/db backfill:legacy-briefs                 # dry run, all tenants
 *   pnpm --filter @oma/db backfill:legacy-briefs -- --apply      # write
 *   pnpm --filter @oma/db backfill:legacy-briefs -- --tenant=<id> --apply
 *
 * Idempotent; never approves a brief.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { backfillLegacyBriefs } from '../src/backfill-legacy-briefs';

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.slice('--tenant='.length).trim() : undefined;
  const prisma = new PrismaClient();
  try {
    const report = await backfillLegacyBriefs(prisma, { dryRun: !apply, tenantId });
    const { createdBriefIds, ...summary } = report;
    console.log(JSON.stringify({ ...summary, createdBriefCount: createdBriefIds.length }, null, 2));
    if (!apply) console.log('Dry run only. Re-run with --apply to write.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
