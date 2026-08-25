import 'reflect-metadata';
import './request-context';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { setupOpenApi } from './openapi';
import { loadEnv } from '@oma/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { cors: false });
  app.use(cookieParser());
  app.setGlobalPrefix('');
  const document = setupOpenApi(app);
  // OpenAPI artifact is generated only via `pnpm openapi:generate` (or OMA_WRITE_OPENAPI=1)
  // so API boot / tests / builds do not dirty the worktree.
  if (process.env.OMA_WRITE_OPENAPI === '1') {
    try {
      const outDir = join(process.cwd(), '../../packages/api-client');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
    } catch {
      // optional in some run contexts
    }
  }
  await app.listen(env.API_PORT, '127.0.0.1');
  console.log(`API listening on http://127.0.0.1:${env.API_PORT}`);
}

bootstrap();
