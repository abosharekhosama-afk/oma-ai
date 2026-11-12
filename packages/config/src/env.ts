import { z } from 'zod';

export const envSchema = z
  .object({
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
    BRAND_WEBSITE_CONNECTOR: z.enum(['live', 'fixture', 'disabled']).optional(),
    BRAND_MAX_PAGES: z.coerce.number().default(50),
    BRAND_MAX_DEPTH: z.coerce.number().default(3),
    BRAND_MAX_DURATION_SECONDS: z.coerce.number().default(600),
    BRAND_MAX_BYTES: z.coerce.number().default(1_000_000),
    BRAND_MAX_SITEMAP_DOCUMENTS: z.coerce.number().int().positive().default(5),
    BRAND_SCANNER_USER_AGENT: z.string().min(1).default('OMA-BrandScanner/1.0 (+https://oma.ai)'),
    BRAND_SCANNER_ACCEPT_LANGUAGE: z.string().min(1).default('en,ar;q=0.9'),
    BRAND_SCANNER_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    BRAND_SCANNER_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    BRAND_SCANNER_MAX_REDIRECTS: z.coerce.number().int().nonnegative().default(5),
    BRAND_SCANNER_CONCURRENCY: z.coerce.number().int().positive().default(1),
    BRAND_SCANNER_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
    BRAND_SCANNER_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
    BRAND_ALLOWED_PORTS: z
      .string()
      .default('80,443')
      .transform((v) =>
        v
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((port) => Number.isInteger(port) && port > 0 && port < 65536),
      )
      .refine((ports) => ports.length > 0, 'BRAND_ALLOWED_PORTS must include at least one port'),
    /** Default true: do not skip URLs disallowed by robots.txt during brand scans. */
    BRAND_SCANNER_IGNORE_ROBOTS_TXT: z
      .enum(['0', '1', 'true', 'false'])
      .optional()
      .transform((v) => v === undefined || v === '1' || v === 'true'),
    BRAND_SCANNER_ALLOW_PRIVATE_HOSTS: z
      .enum(['0', '1', 'true', 'false'])
      .optional()
      .transform((v) => v === '1' || v === 'true'),
    /** off = static HTML only; auto = Playwright when SPA shell or empty catalog path; always = every page (costly). */
    BRAND_SCANNER_JS_RENDER_MODE: z.enum(['off', 'auto', 'always']).default('off'),
    BRAND_SCANNER_JS_RENDER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES: z
      .enum(['0', '1', 'true', 'false'])
      .optional()
      .transform((v) => v === undefined || v === '1' || v === 'true'),
    /** Feature 003: AI propose always refuses unless a future DEC enables a live adapter. */
    /** `live` proposes when AI is available; `refuse`/`not_configured` always return 503. */
    STRATEGY_AI_MODE: z.enum(['live', 'refuse', 'not_configured']).default('live'),
    /**
     * Complete-product demo surfaces. Hard-disabled when NODE_ENV=production.
     * Allowed values: unset/0/false (off) or 1/true (on in development|test only).
     */
    OMA_DEMO_MODE: z
      .enum(['0', '1', 'true', 'false'])
      .optional()
      .transform((v) => v === '1' || v === 'true'),
    /**
     * Explicit opt-in to allow demo surfaces when NODE_ENV=production.
     * For preview/staging only — never enable on real customer production.
     */
    OMA_DEMO_ALLOW_PRODUCTION: z
      .enum(['0', '1', 'true', 'false'])
      .optional()
      .transform((v) => v === '1' || v === 'true'),
    /** Text intelligence only. Production stays offline unless explicitly enabled. */
    AI_PROVIDER: z.enum(['openai', 'grok', 'groq', 'gemini']).default('openai'),
    AI_LIVE_ENABLED: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
    OPENAI_API_KEY: z.string().optional().default(''),
    XAI_API_KEY: z.string().optional().default(''),
    GROQ_API_KEY: z.string().optional().default(''),
    GEMINI_API_KEY: z.string().optional().default(''),
    OPENAI_PROJECT_ID: z.string().optional().default(''),
    OPENAI_BASE_URL: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.string().url().optional(),
    ),
    GROQ_BASE_URL: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.string().url().optional(),
    ),
    AI_DEFAULT_MODEL: z.string().optional().default(''),
    AI_REASONING_MODEL: z.string().optional().default(''),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    AI_BRAND_ANALYSIS_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
    AI_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
    AI_MODEL_PRICES_JSON: z.string().optional().default(''),
    AI_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(25),
    AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(2),
    AI_MAX_INPUT_TOKENS: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
    AI_MAX_OUTPUT_TOKENS: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce.number().int().positive().optional(),
    ),
    AI_MAX_TENANT_CONCURRENCY: z.coerce.number().int().positive().default(2),
  })
  .superRefine((env, ctx) => {
    if (!env.AI_LIVE_ENABLED) return;
    const requiredKey =
      env.AI_PROVIDER === 'grok'
        ? env.XAI_API_KEY
        : env.AI_PROVIDER === 'groq'
          ? env.GROQ_API_KEY
          : env.AI_PROVIDER === 'gemini'
            ? env.GEMINI_API_KEY
            : env.OPENAI_API_KEY;
    if (!requiredKey?.trim()) {
      const keyName =
        env.AI_PROVIDER === 'grok'
          ? 'XAI_API_KEY'
          : env.AI_PROVIDER === 'groq'
            ? 'GROQ_API_KEY'
            : env.AI_PROVIDER === 'gemini'
              ? 'GEMINI_API_KEY'
              : 'OPENAI_API_KEY';
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `AI_LIVE_ENABLED=true with AI_PROVIDER=${env.AI_PROVIDER} requires ${keyName}`,
        path: [keyName],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.parse(source);
  if (
    parsed.NODE_ENV === 'production' &&
    parsed.OMA_DEMO_MODE &&
    !parsed.OMA_DEMO_ALLOW_PRODUCTION
  ) {
    throw new Error('OMA_DEMO_MODE requires OMA_DEMO_ALLOW_PRODUCTION=1 in production');
  }
  if (parsed.NODE_ENV === 'production' && parsed.BRAND_SCANNER_ALLOW_PRIVATE_HOSTS) {
    throw new Error('BRAND_SCANNER_ALLOW_PRIVATE_HOSTS cannot be enabled in production');
  }
  return parsed;
}
