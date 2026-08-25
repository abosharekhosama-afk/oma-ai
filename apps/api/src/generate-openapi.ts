import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { setupOpenApi } from './openapi';

/**
 * Deterministic OpenAPI generation (does not start the HTTP server).
 * Usage: `pnpm openapi:generate`
 */
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = setupOpenApi(app);
  const outDir = join(process.cwd(), '../../packages/api-client');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'openapi.json');
  writeFileSync(outFile, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`Wrote ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
