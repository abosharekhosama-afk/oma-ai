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
  BRAND_FIXTURE_CONNECTOR: z
    .enum(['0', '1'])
    .optional()
    .transform((v) => v === '1'),
  BRAND_MAX_PAGES: z.coerce.number().default(50),
  BRAND_MAX_DEPTH: z.coerce.number().default(3),
  BRAND_MAX_DURATION_SECONDS: z.coerce.number().default(600),
  BRAND_MAX_BYTES: z.coerce.number().default(1_000_000),
  /** Feature 003: AI propose always refuses unless a future DEC enables a live adapter. */
  STRATEGY_AI_MODE: z.enum(['refuse', 'not_configured']).default('refuse'),
  /**
   * Complete-product demo surfaces. Hard-disabled when NODE_ENV=production.
   * Allowed values: unset/0/false (off) or 1/true (on in development|test only).
   */
  OMA_DEMO_MODE: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.parse(source);
  if (parsed.NODE_ENV === 'production' && parsed.OMA_DEMO_MODE) {
    throw new Error('OMA_DEMO_MODE cannot activate in production');
  }
  return parsed;
}
