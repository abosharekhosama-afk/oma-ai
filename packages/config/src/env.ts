import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:3000'),
  API_PUBLIC_URL: z.string().url().default('http://127.0.0.1:3001'),
  SESSION_COOKIE_NAME: z.string().default('oma_session'),
  SESSION_TTL_SECONDS: z.coerce.number().default(604800),
  CSRF_COOKIE_NAME: z.string().default('oma_csrf'),
  BOOTSTRAP_PLATFORM_OWNER_EMAIL: z.string().email().optional(),
  BOOTSTRAP_PLATFORM_OWNER_PASSWORD: z.string().min(12).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
