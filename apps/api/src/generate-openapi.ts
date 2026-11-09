import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPrisma } from '@oma/db';
import { AppModule } from './app.module';
import { setupOpenApi } from './openapi';

/**
 * Deterministic OpenAPI generation (does not start the HTTP server).
 * Usage: `pnpm openapi:generate`
 *
 * Nest bootstrap can leave Redis/Prisma handles open (e.g. analytics cache
 * connecting when REDIS_URL is set in CI). Always exit explicitly so the
 * "OpenAPI generate stays clean" workflow step cannot hang.
 */
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    const document = setupOpenApi(app);
    const outDir = join(process.cwd(), '../../packages/api-client');
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, 'openapi.json');
    writeFileSync(outFile, `${JSON.stringify(document, null, 2)}\n`);
    console.log(`Wrote ${outFile}`);
  } finally {
    await app.close();
    await getPrisma()
      .$disconnect()
      .catch(() => undefined);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
