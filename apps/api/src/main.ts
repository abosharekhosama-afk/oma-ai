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
  const isProd = env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    cors: isProd
      ? {
          origin: env.WEB_ORIGIN,
          credentials: true,
        }
      : false,
  });

  app.use(cookieParser());
  app.setGlobalPrefix('');

  const document = setupOpenApi(app);
  if (process.env.OMA_WRITE_OPENAPI === '1') {
    try {
      const outDir = join(process.cwd(), '../../packages/api-client');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
    } catch {
      // optional
    }
  }

  // Render يمرر PORT — محلياً نستخدم API_PORT
  const port = Number(process.env.PORT ?? env.API_PORT ?? 3001);
  const host = isProd ? '0.0.0.0' : '127.0.0.1';

  await app.listen(port, host);
  console.log(`API listening on http://${host}:${port}`);
}

bootstrap();
