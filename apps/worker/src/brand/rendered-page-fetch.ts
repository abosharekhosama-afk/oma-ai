import type { Browser } from 'playwright-core';

let sharedBrowser: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser) return sharedBrowser;
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright-core');
      sharedBrowser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      return sharedBrowser;
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

export class RenderedPageFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RenderedPageFetchError';
  }
}

export async function fetchRenderedPageHtml(url: string): Promise<string> {
  const timeoutMs = Number(process.env.BRAND_SCANNER_JS_RENDER_TIMEOUT_MS ?? 30_000);
  const blockHeavy =
    process.env.BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES === undefined ||
    process.env.BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES === '1' ||
    process.env.BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES === 'true';

  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (cause) {
    throw new RenderedPageFetchError(
      'PLAYWRIGHT_NOT_AVAILABLE',
      cause instanceof Error ? cause.message : 'playwright-core is not available',
    );
  }

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
      await page.route('**/*', (route) => {
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

    await page.waitForTimeout(Math.min(2_500, Math.max(500, Math.floor(timeoutMs / 12))));
    const html = await page.content();
    if (html.length > Number(process.env.BRAND_MAX_BYTES ?? 1_000_000)) {
      throw new RenderedPageFetchError('RENDER_TOO_LARGE', 'Rendered HTML exceeds BRAND_MAX_BYTES');
    }
    return html;
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}
