import { existsSync } from 'node:fs';
import type { Browser, Route } from 'playwright';
import { classifyJsRenderError } from '@oma/domain';
import { RenderedPageFetchError } from './rendered-page-fetch.errors';

export { RenderedPageFetchError } from './rendered-page-fetch.errors';

let sharedBrowser: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
let browserInitError: string | null = null;

async function resolveChromiumExecutable(): Promise<string | undefined> {
  const fromEnv =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_PATH?.trim() ||
    process.env.GOOGLE_CHROME_SHIM?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      browserInitError = `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH does not exist: ${fromEnv}`;
      return undefined;
    }
    return fromEnv;
  }
  try {
    const pw = await import('playwright');
    const path = pw.chromium.executablePath();
    if (path && existsSync(path)) return path;
    browserInitError =
      'Chromium binary not found in Playwright cache; on the worker host run: pnpm --filter @oma/worker run setup:chromium';
    return undefined;
  } catch {
    browserInitError = 'playwright package failed to resolve chromium.executablePath()';
    return undefined;
  }
}

export function lastBrowserInitError(): string | null {
  return browserInitError;
}

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser) return sharedBrowser;
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright');
      const executablePath = await resolveChromiumExecutable();
      if (!executablePath) {
        const hint =
          browserInitError ??
          'no Chromium binary; run pnpm --filter @oma/worker run setup:chromium on the worker host';
        browserInitError = hint;
        throw new RenderedPageFetchError('PLAYWRIGHT_LAUNCH_FAILED', hint);
      }
      try {
        sharedBrowser = await chromium.launch({
          headless: true,
          executablePath,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        browserInitError = null;
        return sharedBrowser;
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause);
        browserInitError = `launch failed (${executablePath}): ${msg}`;
        throw new RenderedPageFetchError('PLAYWRIGHT_LAUNCH_FAILED', browserInitError);
      }
    })();
  }
  return browserPromise;
}

export async function shutdownRenderedFetchBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => undefined);
    sharedBrowser = null;
    browserPromise = null;
  }
}

export async function fetchRenderedPageHtml(url: string): Promise<string> {
  const timeoutMs = Number(process.env.BRAND_SCANNER_JS_RENDER_TIMEOUT_MS ?? 30_000);
  const blockHeavy =
    process.env.BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES === undefined ||
    process.env.BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES === '1' ||
    process.env.BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES === 'true';

  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent: process.env.BRAND_SCANNER_USER_AGENT,
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': process.env.BRAND_SCANNER_ACCEPT_LANGUAGE ?? 'en,ar;q=0.9',
    },
  });
  const page = await context.newPage();

  try {
    if (blockHeavy) {
      await page.route('**/*', (route: Route) => {
        const type = route.request().resourceType();
        if (type === 'image' || type === 'font' || type === 'media') {
          void route.abort();
          return;
        }
        void route.continue();
      });
    }

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    if (!response) {
      throw new RenderedPageFetchError(
        'RENDER_NO_RESPONSE',
        'No response from rendered navigation',
      );
    }
    if (response.status() >= 400) {
      throw new RenderedPageFetchError(
        `RENDER_HTTP_${response.status()}`,
        `Rendered fetch HTTP ${response.status()}`,
      );
    }

    try {
      await page.waitForLoadState('networkidle', {
        timeout: Math.min(15_000, Math.max(3_000, Math.floor(timeoutMs / 2))),
      });
    } catch {
      // SPAs may never reach networkidle; continue with a short settle delay.
    }
    await page.waitForTimeout(Math.min(4_000, Math.max(800, Math.floor(timeoutMs / 8))));

    const html = await page.content();
    if (html.length > Number(process.env.BRAND_MAX_BYTES ?? 1_000_000)) {
      throw new RenderedPageFetchError('RENDER_TOO_LARGE', 'Rendered HTML exceeds BRAND_MAX_BYTES');
    }
    return html;
  } catch (err) {
    if (err instanceof RenderedPageFetchError) throw err;
    const classified = classifyJsRenderError(err);
    throw new RenderedPageFetchError(classified.code, classified.message);
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}
