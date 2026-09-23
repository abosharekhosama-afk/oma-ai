/**
 * Read-only Planable screenshots over the local OMA References CDP.
 * Does not click Create, Save, Approve, Schedule, or Publish.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('artifacts/planable-oma-visual-differential/planable');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
if (!context) throw new Error('no CDP context');
const page = context.pages().find((p) => p.url().includes('app.planable.io')) ?? context.pages()[0];
if (!page) throw new Error('no page');
await page.bringToFront();

const shots = [];
async function shot(name, note) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file) });
  const meta = {
    evidenceId: `EV-PL-${name}`,
    product: 'Planable',
    sourceLevel: 'LIVE_VERIFIED',
    route: new URL(page.url()).pathname,
    viewport: `${page.viewportSize()?.width ?? 'window'}`,
    locale: 'en',
    state: name,
    timestamp: new Date().toISOString(),
    servedSha: null,
    referenceUrl: page.url().split('?')[0],
    screenshot: file,
    consoleErrors: [],
    overflow: null,
    notes: note,
    piiScrub: 'url-path-only',
  };
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(meta, null, 2));
  shots.push(meta);
  console.log('ok', file, page.url());
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(800);
await shot('dashboard-1440', 'Authenticated dashboard. No mutation.');

const labels = await page.locator('button, a, [role="tab"]').allInnerTexts();
const interesting = labels
  .map((t) => t.replace(/\s+/g, ' ').trim())
  .filter((t) => /feed|calendar|list|grid|filter|view/i.test(t))
  .slice(0, 20);
fs.writeFileSync(path.join(out, 'visible-labels.json'), JSON.stringify(interesting, null, 2));

for (const label of ['Calendar', 'Feed', 'List', 'Grid']) {
  const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(600);
    await shot(`${label.toLowerCase()}-1440`, `View switch only. Label ${label}.`);
  } else {
    shots.push({
      evidenceId: `EV-PL-${label.toLowerCase()}-missing`,
      product: 'Planable',
      sourceLevel: 'ACCESS_BLOCKED',
      state: label,
      notes: 'Control not found on the current workspace without opening create flows.',
      timestamp: new Date().toISOString(),
    });
    console.log('missing', label);
  }
}

await page.setViewportSize({ width: 1024, height: 768 });
await page.waitForTimeout(400);
await shot('dashboard-1024', 'Responsive width only.');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await shot('dashboard-390', 'Mobile width only.');

fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(shots, null, 2));
await browser.close();
